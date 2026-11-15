# **Plan de Proyecto: Diario Online de Anotaciones Diarias**

# **1\. Visión General del Proyecto**

Desarrollo de una aplicación web ligera de **Diario Online** orientada a notas diarias categorizadas por tipos (Ideas, Privadas, Listas y Trabajo/Timesheet). La aplicación está construida con Express.js, desplegable en Vercel como Serverless Functions y conectada a una base de datos relacional PostgreSQL gratuita (Neon / Supabase).

# **2\. Definición de Tipos de Notas e Iconografía**

Cada nota mantendrá su hora exacta de creación (`HH:mm`) y se identificará visualmente por un icono distintivo:

| Tipo | Icono | Descripción / Comportamiento Visual |
| :---- | :---- | :---- |
| **Idea** | 💡 | Notas conceptuales o pensamientos rápidos en texto plano. |
| **Privada** | 🔒 | Se ocultan bajo un menú desplegable (persiana). Requieren PIN activo para ver/desbloquear. |
| **Lista** | ☑️ | Ítems interactivos (`{ text, done }`) para marcar/desmarcar tareas finalizadas. |
| **Trabajo / Timesheet** | 💼 | Anotaciones de tareas laborales especificando horas/minutos dedicados para facilitar el reporte diario de timesheet. |

# **3\. Arquitectura del Sistema y Stack Tecnológico**

* **Backend:** Node.js \+ Express.js, utilizando `serverless-http` para compatibilidad nativa con Vercel.  
* **Base de Datos:** PostgreSQL en la nube (Neon / Supabase), gestionada mediante Knex.js / Prisma.  
* **Frontend:** HTML5, JavaScript Vanilla / Alpine.js y Bootstrap 5 para una interfaz limpia, rápida y responsiva.  
* **Flujo de Trabajo:** OpenCode \+ Git Ops para despliegues automáticos a Vercel con cada commit.

# **4\. Esquema de Base de Datos (PostgreSQL)**

## **Tabla: `users`**

* `id` (UUID, PK)  
* `email` (VARCHAR, Unique)  
* `password_hash` (TEXT)  
* `global_pin_hash` (TEXT)  
* `created_at` (TIMESTAMPTZ)

## **Tabla: `notes`**

* `id` (UUID, PK)  
* `user_id` (UUID, FK \-\> users.id)  
* `note_date` (DATE) — Fecha de asignación (YYYY-MM-DD)  
* `type` (VARCHAR) — `IDEA`, `PRIVATE`, `CHECKLIST`, `WORK`  
* `title` (TEXT, Opcional)  
* `content` (JSONB) — Flexible para texto plano, arrays de lista `[{ text, done }]` o metadatos de timesheet `{ task, duration_mins }`  
* `is_private` (BOOLEAN)  
* `created_at` (TIMESTAMPTZ) — Hora de creación

# **5\. Diseño de Interfaz y Navegación**

* **Barra Superior (Header):**  
  * **Navegación de Fecha:** Flechas `←` y `→` para desplazamiento día por día, selector modal de fecha 📅 y visualizador del día activo (`DD/MM/YYYY`).  
  * **Control de PIN (Seguridad):** Botón de candado 🔓/🔒 para ingresar el PIN global y desbloquear/bloquear las notas privadas.  
  * **Buscador:** Input con filtro toggle entre **Día actual** e **Histórico completo (All)**, permitiendo además filtrar por el tipo **Trabajo (Timesheet)**.

# **6\. Plan de Implementación Fase por Fase**

## **Fase 1: Inicialización del Proyecto**

1. Estructura de carpetas (`api/`, `public/`, `src/routes/`, `src/controllers/`, `src/models/`).  
2. Configuración de Express, variables de entorno (`.env`) y wrapper `serverless-http` para Vercel.  
3. Creación del script de migraciones de PostgreSQL con el tipo `WORK`.

## **Fase 2: Backend & Endpoints API**

1. Autenticación de usuario e inicio de sesión.  
2. Endpoint POST `/api/verify-pin` para validar el PIN global.  
3. Endpoints CRUD de notas (`GET /api/notes?date=YYYY-MM-DD`, `POST /api/notes`, `PUT /api/notes/:id`, `DELETE /api/notes/:id`).  
4. Endpoint de búsqueda `/api/notes/search?q=query&type=WORK&all=true`.

## **Fase 3: Frontend & Componentes Interactivos**

1. Construcción del Header con controles de fecha y candado de PIN.  
2. Renderizado dinámico de tarjetas por tipo (💡 Idea, 🔒 Privada persiana, ☑️ Lista checklist, 💼 Trabajo/Timesheet).  
3. Componente de menú persiana con desenfoque/bloqueo visual para notas privadas.  
4. Vista y filtro de Timesheet para resumen de horas de trabajo al final del día.

## **Fase 4: Despliegue en Vercel & Pruebas**

1. Conexión de repositorio con Vercel.  
2. Configuración de variables de entorno de base de datos en el dashboard de Vercel.  
3. Pruebas end-to-end de navegación por fechas, desbloqueo de PIN y reporte de timesheet.

