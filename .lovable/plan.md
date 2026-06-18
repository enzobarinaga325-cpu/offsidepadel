# Múltiples categorías por torneo

Ampliación del módulo de torneos para soportar varias categorías dentro de un mismo torneo, cada una con cupos, parejas, fixture, standings y campeones independientes. Incluye nuevos tipos (Caballeros/Damas/Mixto) y categorías "Suma N" con validación automática de la suma de niveles de ambos jugadores.

No se modifica: auth, usuarios, ranking, diseño, panel general. Solo se amplía el módulo de torneos. Los torneos existentes siguen funcionando (se migran a una categoría única por defecto).

## 1. Cambios de base de datos (migración)

### Nueva tabla `tournament_categories`
Una fila por categoría dentro de un torneo. Aquí pasan a vivir cupos, fixture y estado.

Campos:
- `tournament_id` → FK a `tournaments`
- `category_id` → FK a `categories` (referencia a la categoría base: 3ª…8ª)
- `gender` → enum `tournament_gender` (`mens` | `womens` | `mixed`)
- `mode` → enum `tournament_category_mode` (`normal` | `suma`)
- `suma_value` → int, requerido si `mode='suma'` (ej. 8, 10, 12)
- `label` → texto opcional (ej. "Suma 8 Caballeros") — auto-generado si vacío
- `max_pairs`, `waitlist_enabled`, `registration_open`, `status` (`open|in_progress|closed|finished`)
- `position` para orden de visualización
- Único parcial: `(tournament_id, category_id, gender, mode, suma_value)` para evitar duplicados

GRANT a `authenticated` (SELECT) y `service_role` (ALL). RLS:
- SELECT público (anon+authenticated)
- ALL solo `has_role(auth.uid(),'admin')`

### Columnas nuevas en tablas existentes
- `registrations.tournament_category_id uuid` (nullable durante migración, luego NOT NULL)
- `matches.tournament_category_id uuid`
- `tournament_groups.tournament_category_id uuid`
- `ranking_points.tournament_category_id uuid` (nullable)

Todas con FK a `tournament_categories(id) ON DELETE CASCADE`.

### Migración de datos existentes
Para cada `tournaments` actual:
1. Crear una fila en `tournament_categories` con `category_id = tournaments.category_id`, `gender='mens'` por defecto (o el actual si existe), `mode='normal'`.
2. Backfill `registrations.tournament_category_id`, `matches.tournament_category_id`, `tournament_groups.tournament_category_id`, `ranking_points.tournament_category_id` con esa fila.
3. `tournaments.category_id` y `max_pairs` quedan como legacy (se mantienen para no romper nada; nuevas inscripciones usan `tournament_categories`).

### Funciones SQL actualizadas
- `generate_fixture(_tournament_id)` → reemplazada por `generate_fixture_for_category(_tournament_category_id)`. La vieja se mantiene como wrapper para compatibilidad: aplica a la primera/única categoría del torneo.
- `finalize_tournament` → `finalize_tournament_category(_tournament_category_id)`. Wrapper viejo finaliza todas las categorías del torneo.
- `recompute_standings` no cambia (sigue trabajando por `group_id`).
- Nueva función `validate_pair_for_category(_pair_id, _tournament_category_id)`:
  - Si `mode='normal'`: ambos jugadores deben tener `profiles.category_id` igual o "mejor" (según nivel) — comportamiento conservador: igual al `category_id` de la categoría del torneo.
  - Si `mode='suma'`: lee los niveles numéricos de `categories.level` de ambos jugadores y exige `level1 + level2 = suma_value`. Si algún jugador no tiene categoría asignada → error claro.
  - Validación de género contra `profiles.gender` (cuando exista) en `mens`/`womens`; `mixed` exige uno de cada.
- Trigger `BEFORE INSERT OR UPDATE` en `registrations` que llame a `validate_pair_for_category` cuando `tournament_category_id` esté presente, lanzando excepción con mensaje legible en español.

## 2. Backend / Edge functions

- `public-categories` sin cambios (sigue devolviendo categorías base 1ª–8ª para el registro de usuarios).
- No se necesitan nuevas edge functions: todo va por cliente con RLS + funciones SECURITY DEFINER.

## 3. Cambios de UI

### Admin — crear/editar torneo (`AdminTournamentForm.tsx`)
Agregar sección **"Categorías del torneo"**:
- Lista editable de categorías (add/remove/edit antes de guardar).
- Cada fila: `Género` (Caballeros/Damas/Mixto) · `Modo` (Normal/Suma) · si Normal → selector de categoría base (3ª–8ª) · si Suma → input numérico `Valor suma` (6–12) · `Cupos` · `Lista de espera (sí/no)`.
- Preview del label auto-generado (ej. "Suma 8 Caballeros", "5ª Damas").
- Validación: al menos 1 categoría.
- Persistencia: tras guardar el torneo, upsert/diff de `tournament_categories`.
- Se oculta el viejo selector único `category_id` (queda en BD por compatibilidad, se llena con la primera categoría agregada).

### Admin — gestión de torneo (`AdminTournamentManage.tsx`)
- Tabs o selector superior con las categorías del torneo.
- Cada tab muestra: inscriptos, lista de espera, generar fixture, fixture, standings, finalizar — todo scoped a la `tournament_category_id` seleccionada.
- Botón "Cerrar categoría" que cambia `status='closed'` sin tocar el torneo.
- Botón "Agregar categoría" / "Eliminar categoría" (con confirmación si tiene inscriptos).

### Player — detalle de torneo (`TournamentDetail.tsx`)
- Encabezado del torneo + lista vertical (mobile-first) de categorías como tarjetas:
  - Label, cupos `inscriptos/max`, estado, botón "Inscribirse" si abierta.
- Al elegir categoría → se entra a la vista detalle de esa categoría: fixture (`FixtureView`), standings (`StandingsView`), botón inscribir.
- `RegisterDialog` recibe `tournament_category_id` y muestra el detalle (ej. "Suma 8 — la suma de niveles debe ser exactamente 8").

### Player — inscripción (`RegisterDialog.tsx`)
- Validación cliente previa al insert:
  - Lee `categories.level` del jugador actual y del partner elegido.
  - Si `mode='suma'`: chequea `level1 + level2 === suma_value`; si no, muestra toast: *"La suma de categorías (X + Y = Z) no coincide con Suma N de esta categoría."*
  - Si `mode='normal'`: ambos deben tener `category_id` igual al de la categoría del torneo; si no, mensaje claro.
  - Género: mens/womens exigen ambos del mismo género; mixed exige 1 y 1.
- El trigger de BD es la red de seguridad (mismo mensaje).

### Listado general de torneos (`Tournaments.tsx`)
- Cada tarjeta de torneo muestra chips con sus categorías (label compacto). Sin cambios estructurales mayores.

## 4. Helpers / utilidades

`src/lib/tournament-helpers.ts`:
- `categoryLabel(tc)` → "Suma 8 Caballeros" / "5ª Damas".
- `validateSumaPair(level1, level2, sumaValue)` → boolean + mensaje.
- `validateNormalPair(catA, catB, requiredCat)` → boolean.
- `validateGenderPair(g1, g2, mode)` → boolean.

## 5. Compatibilidad

- Torneos previos: la migración crea una `tournament_categories` por torneo existente y backfillea FKs → la UI nueva los muestra como "1 categoría" y todo (fixture, standings, ranking ya otorgado) sigue funcionando.
- Vistas que aún usan `tournament_id` para listar partidos siguen funcionando porque la columna `tournament_id` se mantiene en `matches`; solo se filtra adicionalmente por `tournament_category_id` cuando hay tab activa.
- `ranking_points` se sigue calculando, ahora etiquetado con `tournament_category_id` para análisis futuros, sin tocar el cálculo del ranking actual.

## 6. Plan de verificación

- `tsc --noEmit` limpio.
- Torneo existente: abrir, ver fixture/standings/ranking — sin cambios visibles.
- Crear torneo nuevo con 4 categorías mixtas (1 normal Damas, 1 normal Caballeros, 1 Suma 8 Caballeros, 1 Suma 10 Mixto):
  - Inscribir parejas válidas → OK.
  - Inscribir pareja con suma incorrecta → error claro.
  - Generar fixture por categoría → matches solo dentro de la categoría.
  - Finalizar una categoría → no cierra las demás.
- Mobile (390px): tabs y tarjetas se ven correctamente.

## Detalles técnicos

- Enums nuevos: `tournament_gender` y `tournament_category_mode` en `public`.
- Restricción CHECK simple: `mode='suma' AND suma_value IS NOT NULL` o `mode='normal' AND category_id IS NOT NULL` se valida vía trigger (no CHECK, para mantener flexibilidad).
- Índices: `idx_tournament_categories_tournament`, `idx_registrations_tcat`, `idx_matches_tcat`.
- Mantener `tournaments.category_id` y `tournaments.max_pairs` como deprecados pero presentes.
- `useIsAdmin`, RLS de `categories`, `user_roles`, `profiles` y `notifications`: sin cambios.
