# HAES Web Client

The web client is a second presentation layer over the same services the JavaFX
desktop app uses. No scheduling rule lives in the web module: booking conflicts,
authorization for row-level actions, priority dispatch and escalation all stay in
`service/`.

## Running

| Mode | Command | URL |
| --- | --- | --- |
| Dev (API) | `mvnw.cmd spring-boot:run` | http://localhost:8080 |
| Dev (SPA) | `cd frontend && npm run dev` | http://localhost:5173 |
| Packaged | `cd frontend && npm run build && cd ..` then `mvnw.cmd -Pweb package` then `java -jar target/haes-1.0.0.jar` | http://localhost:8080 |

Configuration (`src/main/resources/application.yml`):

| Property | Default | Meaning |
| --- | --- | --- |
| `haes.db` | `haes.db` | SQLite file shared with the desktop client |
| `haes.audit` | `emergency_audit.log` | Append-only emergency audit file |
| `haes.emergency.auto-start` | `true` | Start the dispatcher and escalation timer |
| `server.port` | `8080` | HTTP port |

Run only one client against a database at a time: the in-memory emergency queue, bed
pool and notification bus are per process.

## Session model

1. `POST /api/auth/login` verifies credentials through `AuthService` (PBKDF2).
2. The server issues an opaque random token in an **HttpOnly, SameSite=Lax** cookie
   named `HAES_SESSION`, valid for 8 idle hours.
3. `SessionInterceptor` resolves the cookie on every `/api/**` request, attaches the
   session, and enforces `@RequireRole` for coarse endpoint access.
4. Row-level rules remain in the services (`ensureCanManage`, `acknowledge`,
   `resolve`). The booking controller additionally forces a patient's own id when a
   PATIENT books, because `AppointmentService.book` intentionally has no actor check.

The SPA never receives a domain `User`: every response is a DTO from `ApiMapper`, which
omits `passwordHash`.

## API surface

All paths are under `/api`. Unless noted, a valid session is required.

| Area | Endpoints |
| --- | --- |
| Health | `GET /health` (public) |
| Auth | `POST /auth/login`, `POST /auth/register` (public); `POST /auth/logout`; `GET /auth/me`; `POST /auth/change-password` |
| Users | `GET /users?role=` (admin), `GET /users/patients`, `GET /users/doctors`, `GET /users/responders` (admin), `GET/POST/PUT/DELETE /users/{id}` (admin) |
| Departments | `GET /departments`; `POST/PUT/DELETE /departments/{id}` (admin) |
| Slots | `GET /slots/available?departmentId&doctorId&date`, `GET /slots/mine` (doctor), `POST /slots` (doctor), `DELETE /slots/{id}` (doctor/admin) |
| Appointments | `GET /appointments` (role-scoped), `POST /appointments`, `POST /appointments/{id}/reschedule`, `/cancel`, `/status` (doctor/admin), `GET /appointments/waitlist` (reception/admin), `GET /appointments/limits` |
| Emergencies | `POST /emergencies`, `GET /emergencies/board?scope=active\|all`, `GET /emergencies/mine` (patient), `GET /emergencies/{id}`, `/{id}/events`, `POST /{id}/acknowledge` (doctor/ER), `/{id}/resolve`, `POST /emergencies/dispatch` (ER/admin), `GET /emergencies/events/recent`, `GET /emergencies/stats` |
| Notifications | `GET /notifications`; `GET /notifications/stream` (SSE) |
| Reports | `GET /reports/appointments.csv`, `/emergencies.csv`, `POST /reports/slots/import` (multipart), `GET /reports/audit-log` (admin) |

Errors use `{ "status": 400, "error": "Bad Request", "message": "…" }` with these
statuses: 400 validation, 401 anonymous/bad login, 403 not allowed, 409 booking
conflict, 503 no resource, 500 database/unexpected.

## Live updates

`GET /api/notifications/stream` keeps an SSE connection open per signed-in browser.
Each notification is sent as:

```text
event: notification
data: {"id":42,"targetUserId":0,"message":"…","level":"CRITICAL","timestamp":"…"}
```

`SseBridge` subscribes once to `NotificationService` and fans messages out to the
matching user (or every connection for broadcasts). The dispatcher and escalation timer
publish from background threads, so sends are isolated per emitter and dead connections
are dropped. A 15-second heartbeat keeps the connection alive.

The SPA appends notifications to its drawer and re-fetches the emergency board and
appointment views on every event, mirroring `MainWindow.receive()` in the desktop app.

## Role → screen matrix

| Role | Screens |
| --- | --- |
| Patient | Book appointment, My appointments, My emergencies |
| Doctor | My schedule, Availability, My emergencies (assigned) |
| Receptionist | Book for patient, All appointments, Re-booking queue, Emergency board |
| ER staff | Emergency board, All appointments |
| Admin | Users, Departments, Appointments, Re-booking queue, Emergency board, Reports |

## Tests

`mvnw.cmd test` runs the 67 service/desktop tests plus `web/` MockMvc tests covering
authentication, role access, booking conflicts, the patient-id override and emergency
lifecycle. Web tests use a temporary SQLite database and disable the background
dispatcher.
