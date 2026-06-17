Listo, te asigné el rol **admin** a `barderos2811@gmail.com`. Refrescá la app y ya tenés el menú **Administración** completo.

A continuación el plan para entregar **Fase 2 + Fase 3** en una sola tanda.

## Fase 2 — Fixture, Resultados y Ranking

### Nuevas tablas (con RLS + GRANTs)
- `tournament_groups` — grupos de fase regular (`name`, `tournament_id`, `category_id`).
- `matches` — partidos del fixture:
  - `tournament_id`, `category_id`, `group_id?`, `round` (`groups`/`r32`/`r16`/`qf`/`sf`/`final`/`3rd`), `bracket_position`, `pair_a_id`, `pair_b_id`, `winner_pair_id?`, `score_json` (sets), `status` (`scheduled`/`in_progress`/`finished`/`walkover`), `court`, `scheduled_at`, `next_match_id?` (para avance automático en eliminación).
- `match_sets` — opcional embebido como JSON en `matches.score_json` para evitar tabla extra.
- `standings` — tabla de posiciones cacheada por grupo (`group_id`, `pair_id`, `played`, `won`, `lost`, `sets_for`, `sets_against`, `games_for`, `games_against`, `points`).
- `ranking_points` — puntos otorgados a cada jugador por torneo (`tournament_id`, `category_id`, `player_id`, `position`, `points`, `awarded_at`). Es la fuente del ranking acumulado.

### Funciones SQL (SECURITY DEFINER, search_path = public)
- `generate_fixture(tournament_id uuid)` — según `tournaments.type`:
  - `elimination`: arma cuadro por potencia de 2, siembra parejas aprobadas, añade BYE si hace falta, encadena `next_match_id`.
  - `groups_elimination`: reparte parejas en grupos (configurable), genera round-robin por grupo y cuadro de eliminación con clasificados.
  - `round_robin`: todos contra todos.
  - Idempotente: borra fixture previo si el torneo está en `draft`/`open`.
- `submit_match_result(match_id uuid, sets jsonb, walkover_winner uuid default null)` — valida sets, calcula ganador, actualiza `matches`, refresca `standings` si pertenece a grupo, avanza al `next_match_id` en eliminación, dispara notificaciones.
- `finalize_tournament(tournament_id uuid)` — cuando todos los partidos terminan: calcula posiciones finales y reparte `ranking_points` usando `tournament_points_config`. Marca el torneo como `finished`.
- `get_ranking(category_id uuid, from_date date default null, to_date date default null)` — devuelve el ranking acumulado por jugador.
- `get_player_stats(player_id uuid)` — torneos jugados, ganados, % victorias, puntos totales, historial.

### Frontend
- **Admin → Torneo**: nueva pestaña **Fixture** con botón "Generar fixture", vista por rondas/grupos, drag para reasignar cancha/horario, botón "Cargar resultado" por partido (modal con sets), botón "Finalizar torneo".
- **Público → TournamentDetail**: pestañas **Inscriptos / Fixture / Resultados / Posiciones**, todo en tiempo real (Supabase Realtime sobre `matches` y `standings`).
- **Nueva página `/ranking`** — selector de categoría + filtros de fecha, tabla con top jugadores, posición, puntos, torneos jugados.
- **MyProfile**: secciones **Historial** (partidos jugados) y **Estadísticas** (ganados, puntos, mejor categoría).

## Fase 3 — Notificaciones in-app

### Tabla
- `notifications` (`user_id`, `type`, `title`, `body`, `link`, `read_at?`, `created_at`) con RLS: el usuario sólo ve las suyas.

### Disparadores (triggers SQL)
- Inscripción creada → notifica al usuario ("Inscripción recibida").
- `registrations.status` → `approved`/`rejected`/`waitlist` → notifica al jugador y a su compañero.
- Fixture generado → notifica a todas las parejas aprobadas.
- Cambio de `matches.scheduled_at` o `court` → notifica a las 2 parejas.
- Resultado cargado → notifica a las 2 parejas.
- Torneo finalizado → notifica a todos los inscriptos con su posición final y puntos obtenidos.

### Frontend
- Campanita en el header con badge de no leídas, popover con últimas 10, link "Ver todas" → `/notifications`.
- Realtime sobre `notifications` para push instantáneo.
- Marcar como leída al hacer click o con botón "Marcar todas".

## Calidad
- RLS estricta (público sólo lee fixture/resultados/posiciones, admin escribe, jugadores ven sus partidos siempre).
- GRANTs en cada tabla nueva.
- Validación Zod en formularios de resultado.
- Sin pantallas vacías: estados "Fixture aún no generado", "Sin notificaciones", etc.
- Sin botones placeholder.

Si te parece, lo ejecuto ahora: primero la migración (tablas + funciones + triggers + RLS + GRANTs + Realtime), después todo el frontend.
