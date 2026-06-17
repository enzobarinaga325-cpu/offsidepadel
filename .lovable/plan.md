## Plan — Módulo Torneos y Ranking de Pádel (Fase 1)

Vamos a transformar la app (hoy gestor de bugs) en una plataforma de **Torneos y Ranking de Pádel** con backend real en Lovable Cloud. Entrego por fases para que puedas revisar antes de avanzar.

---

### Qué entra en la Fase 1 (esta entrega)

1. **Limpieza de la app actual**
   - Quitar el módulo de bugs del menú/rutas (Dashboard, Bugs, Analytics, Settings de bugs).
   - Mantener: autenticación, sistema de roles (`user_roles` + `has_role`), tabla `profiles`, bucket `avatars`.
   - Renombrar branding ("Bug Tracker" → "Padel Tournaments") en landing, navbar, títulos y meta.

2. **Base de datos nueva en Lovable Cloud**
   Tablas (todas con RLS + GRANTs + `created_at`/`updated_at`):
   - `categories` — nombre, género (M/F/Mixto), nivel, descripción.
   - `tournaments` — nombre, imagen, fecha, horario, lugar, `category_id`, tipo (`elimination` | `groups_elimination` | `round_robin`), valor_inscripcion, cupos, reglamento, premios, estado (`upcoming` | `open` | `full` | `in_progress` | `finished`), `created_by`.
   - `players` — perfil extendido del jugador (apunta a `profiles.user_id`): nivel, lado preferido (drive/revés), teléfono, ciudad.
   - `pairs` — `player1_id`, `player2_id`, `tournament_id` (parejas se crean por torneo).
   - `registrations` — `tournament_id`, `pair_id`, estado (`pending` | `approved` | `rejected` | `waitlist`), notas admin, fecha.
   - `tournament_points_config` — puntos por instancia (campeón, finalista, semi, cuartos, participación) por torneo o por categoría.
   - Tablas vacías reservadas para Fase 2 las creo recién cuando toque (matches, groups, rankings, notifications, payments) para no ensuciar el esquema.

3. **Storage**
   - Bucket público `tournament-images` para portadas de torneos.

4. **Vista pública de Torneos** (`/tournaments`)
   - Listado con tarjetas: imagen, nombre, fecha, lugar, categoría, tipo, precio, cupos ocupados/totales, badge de estado.
   - Filtros: categoría, estado, fecha.
   - Detalle del torneo (`/tournaments/:id`): info completa, reglamento, premios, parejas inscriptas (aprobadas), cupos restantes, botón **Inscribirme**.

5. **Flujo de inscripción**
   - Usuario logueado elige compañero (buscador entre jugadores registrados; si el compañero no existe, puede invitarlo por email — se guarda como pendiente).
   - Confirmación de datos → crea `pair` + `registration` con estado `pending`.
   - El usuario ve sus inscripciones y el estado en su perfil (`/me`).

6. **Panel de Administración** (`/admin`, solo rol `admin`)
   - **Torneos:** crear, editar, duplicar, eliminar, subir imagen, abrir/cerrar inscripciones, cambiar estado.
   - **Categorías:** CRUD completo.
   - **Inscriptos por torneo:** ver todas las inscripciones, aprobar, rechazar, mover a lista de espera, eliminar, agregar parejas manualmente.
   - **Config de puntos:** editar puntos por instancia (queda guardado para Fase 2).

7. **Perfil del jugador** (`/me`)
   - Datos personales (editables).
   - Inscripciones pendientes / aprobadas / rechazadas.
   - Próximos torneos y torneos finalizados (placeholder con datos reales de `registrations`).
   - Secciones de ranking / historial / estadísticas se muestran como "Disponible próximamente" hasta Fase 2.

8. **Diseño**
   - Mantener el sistema de tokens semánticos (colores, tipografía) de la app actual.
   - Rebrand visual hacia pádel (paleta verde cancha + acento naranja pelota, sin romper dark mode).
   - Totalmente responsive (mobile/tablet/desktop), tablas con scroll horizontal en mobile.

9. **Calidad**
   - Validación con Zod en todos los formularios.
   - Sin botones placeholder: lo que no esté en Fase 1 no aparece en la UI.
   - Verificación de RLS, GRANTs, y consola limpia antes de cerrar.

---

### Qué queda para fases siguientes (te aviso al terminar la Fase 1)

- **Fase 2:** Armado automático de fixture (eliminación directa, grupos + eliminación, todos contra todos), carga de resultados, actualización automática del cuadro, ranking por categoría calculado automáticamente, historial completo del jugador y estadísticas.
- **Fase 3:** Notificaciones in-app (inscripción aprobada/rechazada, fixture publicado, cambios de horario, resultados, fin de torneo).
- **Fase 4:** Cobro de inscripción online. Como mencionaste pagos, antes de implementar voy a correr el chequeo de proveedor (`recommend_payment_provider`) y proponerte el más adecuado (Stripe es el más probable para Argentina/LATAM dentro de las opciones nativas de Lovable; MercadoPago no es nativo, requeriría integración custom — lo conversamos cuando lleguemos).

---

### Detalles técnicos

- Stack: React + Vite + Tailwind + shadcn (sin cambios).
- Backend: Lovable Cloud (Supabase gestionado). Todas las tablas en `public` con RLS estricta:
  - Lectura pública de torneos/categorías abiertas.
  - Inscripciones: el dueño ve las suyas, el admin ve todas.
  - Escritura de torneos/categorías: solo `has_role(auth.uid(), 'admin')`.
- Roles: reutilizo `user_roles` y `has_role` ya existentes.
- Imágenes en bucket público `tournament-images` con políticas por rol admin para escritura.
- Edge functions: ninguna necesaria en Fase 1 (todo client + RLS). En Fase 2 sí (generación de fixture y cálculo de ranking).

---

### Migraciones de DB

Voy a aplicar **una sola migración** que crea todas las tablas nuevas de Fase 1 con sus GRANTs, RLS, políticas y triggers de `updated_at`. Te llegará para aprobar antes de ejecutarse.

### Confirmación

Si te parece bien este alcance de Fase 1, lo construyo de corrido. ¿Avanzo?