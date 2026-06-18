## Plan: Sistema de inscripción por parejas y categorías

### Resumen
Rediseñar el módulo de inscripciones para que las parejas se inscriban a **categorías** dentro de un torneo (no al torneo directamente), con búsqueda de compañero, validación de categorías con aprobación manual cuando hay diferencia de nivel, control de cupos por categoría, y gestión administrativa completa.

---

### 1. Cambios en Base de Datos (migración)

**Modificar `registrations`:**
- `tournament_category_id` pasa a ser **NOT NULL** (ya existe la columna).
- Nuevos campos:
  - `partner_confirmed` boolean default false — confirmación del compañero.
  - `invited_by` uuid — quien inició la inscripción.
  - `approval_reason` text — motivo del estado pendiente (ej: "diferencia de categoría").
  - `admin_comment` text — comentario opcional del admin al aprobar/rechazar.
  - `level_diff` int — diferencia numérica entre categorías.

**Modificar `tournament_categories`:**
- `max_pairs` int — cupo máximo por categoría (configurable).

**Reemplazar `validate_registration_pair` trigger:**
- En vez de RAISE EXCEPTION cuando un jugador tiene categoría superior, marcar registration como `status='pending'` con `approval_reason` y `level_diff`.
- Mantener validación estricta de género (mens/womens/mixed).
- Mantener validación estricta de Suma (la suma debe coincidir).
- Validar cupo: si `count(approved) >= max_pairs` ⇒ no permitir inscripciones automáticas (solo admin via SECURITY DEFINER).

**Nuevas funciones SECURITY DEFINER:**
- `search_players(query text)` — busca por nombre/apellido/teléfono (autenticados).
- `request_pair_registration(_tournament_category_id, _partner_user_id)` — crea pair + registration con lógica de pending si hay diff de categoría.
- `confirm_partner(_registration_id)` — el compañero acepta.
- `admin_approve_registration(_registration_id, _comment)` y `admin_reject_registration(_registration_id, _comment)`.
- `admin_create_registration(_tournament_category_id, _player1_id, _player2_id)` — alta directa (bypass cupo opcional).

**Notificaciones:**
- Invitación al compañero (`pair_invitation`).
- Notificación a admins cuando hay pending por diferencia de categoría (`registration_pending_review`).
- Notificación al admin role (nueva función `notify_admins`).

---

### 2. Cambios en el frontend

**`RegisterDialog.tsx`:**
- Paso 1: seleccionar categoría del torneo.
- Paso 2: buscar compañero (input con debounce → llama `search_players`).
- Paso 3: confirmar — mostrar aviso si hay diferencia de categoría: *"Tu categoría es 6ta, la de Juan es 5ta. La inscripción quedará pendiente de aprobación por el administrador."*
- Mostrar cupos disponibles y bloquear si está lleno.

**Nueva pantalla "Mis invitaciones"** (en MyProfile o sección dedicada):
- Listar registrations donde el usuario es player2 y `partner_confirmed=false`.
- Botones aceptar/rechazar.

**`AdminTournamentManage.tsx` (gestión por categoría):**
- Tabs/sección "Inscripciones" por categoría con:
  - Lista de parejas con estado (Pendiente/Aprobada/Rechazada).
  - Cupos: X/Y.
  - Acciones: aprobar, rechazar (con comentario), eliminar, editar pareja, mover a otra categoría.
  - Botón "Agregar pareja manualmente" → abre dialog que busca 2 jugadores y los inscribe directamente.
  - Si no existe el jugador → link rápido a crear jugador (reutiliza `AdminPlayers` flow o mini-form inline).

**`AdminTournamentForm.tsx`:**
- Agregar campo `max_pairs` por categoría.

**Notificaciones admin:**
- Badge en sidebar admin mostrando registrations pending de aprobación.

---

### 3. Compatibilidad / no romper nada

- Rankings (`ranking_points`) ya usan `tournament_category_id` ✓.
- `generate_fixture_for_category` ya filtra por `tournament_category_id` ✓.
- `finalize_tournament_category` ya filtra por `tournament_category_id` ✓.
- Migración backfill: para registrations existentes sin `tournament_category_id`, asignar la primera categoría del torneo.

---

### Detalles técnicos

**SQL clave del nuevo trigger:**
```sql
-- En vez de raise exception por categoría, setear pending:
IF tc.mode = 'normal' AND tc.category_id IS NOT NULL THEN
  lvl_tc := category_level_int((SELECT level FROM categories WHERE id=tc.category_id));
  IF lvl1 < lvl_tc OR lvl2 < lvl_tc THEN
    -- nivel numéricamente menor = categoría superior (1ra < 6ta)
    NEW.status := 'pending';
    NEW.approval_reason := 'Diferencia de categoría';
    NEW.level_diff := GREATEST(lvl_tc - lvl1, lvl_tc - lvl2);
  END IF;
END IF;
```

**Cupos:** verificar en `request_pair_registration` antes de insert. Admin functions hacen bypass.

**Búsqueda de jugadores:** ILIKE sobre `first_name`, `last_name`, `full_name`, `phone_e164`. Solo devuelve `user_id`, `full_name`, `category` (label), `avatar_url` — no expone phone completo.

---

### Archivos a modificar/crear
- `supabase/migrations/*_pair_registration_system.sql` (nuevo)
- `src/components/tournaments/RegisterDialog.tsx` (rediseño completo)
- `src/pages/admin/AdminTournamentManage.tsx` (sección inscripciones por categoría)
- `src/components/admin/AddPairDialog.tsx` (nuevo / actualizar)
- `src/components/admin/RegistrationActions.tsx` (nuevo — aprobar/rechazar)
- `src/pages/MyProfile.tsx` (sección invitaciones pendientes) o nueva ruta `/my-invitations`
- `src/pages/admin/AdminTournamentForm.tsx` (campo max_pairs)
- `src/lib/tournament-helpers.ts` (helpers de búsqueda y estados)

### Validación final
1. Build sin errores.
2. Probar inscripción misma categoría → approved.
3. Probar inscripción con diff de categoría → pending + admin aprueba.
4. Probar cupo lleno → bloqueado para usuarios, admin puede forzar.
5. Verificar fixture y standings siguen funcionando.
6. Mobile responsive.
