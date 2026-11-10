# HAES — Hospital Appointment & Emergency Scheduler

**CSE 213 Integrated Java Project**  
Java 17+ · JavaFX 21 · SQLite (JDBC) · JUnit 5 · Maven

**Repository:** [github.com/mevarx/JAVA-End-sem-project](https://github.com/mevarx/JAVA-End-sem-project)

HAES is a desktop simulation of the two scheduling problems a hospital handles at the same time: planned outpatient appointments and unplanned emergencies. Routine bookings are protected by per-slot locking and database transactions, while emergencies use a priority queue, a background dispatcher, acknowledgment deadlines, escalation, Critical pre-emption and a shared ER bed pool.

> **Academic simulation only.** All data is invented. HAES stores no real patient identifiers and provides no diagnosis, clinical decision support, billing or real notification service.

## Highlights

- **Conflict-free booking** — per-slot `ReentrantLock` plus a SQLite transaction; 50 simultaneous attempts on one slot produce exactly one appointment.
- **Priority emergency dispatch** — `PriorityBlockingQueue` ordered by severity, then arrival time; background dispatcher assigns a matching on-call doctor or ER staff member and a bed.
- **Acknowledgment and escalation** — a scheduled scan escalates unacknowledged cases to the next responder (or warns the duty head when nobody is free) and records every event.
- **Critical pre-emption** — when no doctor is free, a Critical case may pre-empt an in-progress routine appointment; the appointment is marked `PRE_EMPTED`, its slot is freed and the patient is notified.
- **Shared ER bed pool** — a `Semaphore` and bed-number queue prevent two cases from owning the same bed.
- **Role-based JavaFX UI** — Patient, Doctor, Receptionist, ER Staff and Admin each get the tabs they need.
- **Persistence and reporting** — SQLite schema, full CRUD, CSV export/import, append-only emergency audit log and an in-app notification panel.
- **Automated evidence** — 65 JUnit tests including a 50-thread race, escalation/pre-emption lifecycle tests, database-failure tests and measured evaluation tests.

## Quick Start

### Get the code

```bash
git clone https://github.com/mevarx/JAVA-End-sem-project.git
cd JAVA-End-sem-project
```

### Requirements

- JDK **17 or newer** (the project is compiled with `--release 17`; it was verified on JDK 21)
- A desktop session for JavaFX
- No local Maven installation is required — the Maven Wrapper is included

### Run the desktop application

Windows (PowerShell or Command Prompt):

```bat
mvnw.cmd javafx:run
```

macOS / Linux:

```bash
./mvnw javafx:run
```

On first launch HAES creates `haes.db` and `emergency_audit.log` in the working directory, applies `src/main/resources/db/schema.sql`, and seeds the demo hospital. Later launches reuse the same database.

> **Run one client at a time.** The desktop and web clients each start their own
> emergency dispatcher, bed pool and notification bus. Use a separate database for
> development if you need both: `--haes.db=data/web.db`.

### Run the web application

The same service layer is exposed as a REST + SSE API with a React single-page client.
Development uses two terminals:

```bat
:: terminal 1 — Java API on http://localhost:8080
mvnw.cmd spring-boot:run

:: terminal 2 — Vite dev server on http://localhost:5173 (proxies /api)
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173> and sign in with any demo account below.

To build a single runnable jar that serves the API **and** the built SPA:

```bat
cd frontend && npm run build && cd ..
mvnw.cmd -Pweb package
java -jar target/haes-1.0.0.jar
```

Open <http://localhost:8080>. The `web` profile copies `frontend/dist` into the jar and
repackages it; it uses the locally installed Node, so no Node download happens during
the Maven build. See [docs/WEB.md](docs/WEB.md) for the API surface and session model.

### Run the tests

```bat
mvnw.cmd test
```

This runs the 67 original desktop/service tests plus the web-layer API tests (84 in
total).

### Run the tests

```bat
mvnw.cmd test
```

The suite prints the evaluation numbers:

```text
[EVAL] booking race: attempts=50 successes=1 doubleBookings=0 elapsedMs=...
[EVAL] emergency dispatch: cases=8 avgLatencyMs=... maxLatencyMs=...
```

### Measured evidence

| Check | Result |
| --- | --- |
| Test suite | 65 tests, 0 failures, 0 errors |
| 50-way booking race | Exactly 1 winner and 1 persisted appointment; 0 double bookings |
| Emergency dispatch | 76 ms average, 112 ms maximum against a 1,000 ms target |
| ER beds / escalation / pre-emption | Covered by deterministic lifecycle and concurrency tests |

Times vary slightly per run; the JUnit assertions enforce the targets. Full
methodology, baseline caveats and limitations are in
[`docs/EVALUATION.md`](docs/EVALUATION.md).

### Reset the demo

Close the application, then delete the generated runtime files:

```bat
del haes.db haes.db-shm haes.db-wal emergency_audit.log
```

The next launch recreates the schema and demo data.

### Optional database paths

`Main` reads the system properties `haes.db` and `haes.audit`. The defaults are:

| Setting | Default |
| --- | --- |
| SQLite database | `haes.db` in the working directory |
| Audit log | `emergency_audit.log` in the working directory |

## Demo Accounts

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `admin123` |
| Receptionist | `reception` | `reception123` |
| Doctor (Cardiology) | `dr.sharma` | `doctor123` |
| Doctor (Orthopedics) | `dr.rao` | `doctor123` |
| Doctor (Pulmonology) | `dr.iyer` | `doctor123` |
| Doctor (Neurology) | `dr.khan` | `doctor123` |
| Doctor (General Medicine) | `dr.nair` | `doctor123` |
| ER Staff | `er.patel` | `er123` |
| Patient | `patient.anita` | `patient123` |
| Patient | `patient.rahul` | `patient123` |

## Feature Map

| Area | Behaviour |
| --- | --- |
| Accounts | Login, role-based tabs, patient self-registration, password change, admin user CRUD |
| Availability | Doctor/admin defines future slots; overlapping slots are rejected; free slots can be removed |
| Booking | Patients/reception staff book free slots; conflict, overlap and active-appointment-limit rules are enforced |
| Appointments | View, reschedule, cancel, complete, no-show, pre-emption waitlist |
| Emergencies | Raise by type/severity/location; priority dispatch; bed assignment; acknowledge; resolve; escalation |
| Notifications | In-app event feed for confirmations, cancellations, pre-emption and emergency events |
| Reports | Appointment and emergency CSV export; availability CSV import |
| Audit | Append-only `emergency_audit.log` with lifecycle events |
| Administration | Departments and users, role validation, doctor specialization/on-call metadata |

## CSV Availability Import

The importer expects a header and four columns:

```csv
doctor_username,date,start,end
dr.sharma,2027-03-01,09:00,09:30
dr.rao,2027-03-01,10:00,10:30
```

- Dates use `YYYY-MM-DD`; times use `HH:mm` (single-digit hours such as `9:30` are also accepted).
- Blank lines and lines starting with `#` are ignored.
- The first column header `doctor_username` is skipped case-insensitively.
- A ready-to-import example is in [`sample-data/availability.csv`](sample-data/availability.csv).

## Project Structure

```text
src/main/java/com/hospital/haes/
  Main.java                 JavaFX entry point and database bootstrap
  model/                    Users, Booking hierarchy, slots, appointments, emergencies, enums
  service/                  Auth, users, departments, appointments, emergencies, notifications, reporting
  scheduler/                PriorityScheduler, EmergencyDispatcher, EscalationTimer, SlotLockManager, BedPool
  dao/                      Generic Repository, SQLite DAOs, DatabaseManager, SampleData
  exception/                Checked domain exceptions
  util/                     Validation, PBKDF2 hashing, CSV, file logging, Result
  ui/                       JavaFX login, main window, role views, emergency dialog, composition root
  web/                      Spring Boot entry point, REST/SSE controllers, sessions, DTOs
src/main/resources/
  db/schema.sql             SQLite schema
  css/app.css               JavaFX theme
  application.yml           Web server and database configuration
frontend/                   React + TypeScript + Tailwind single-page client
  src/api/                  Typed API client and endpoint functions
  src/pages/                Role screens (patient, doctor, staff, emergency, admin)
  src/components/           Layout, tables, dialogs and UI primitives
src/test/java/com/hospital/haes/
  ...                       67 service/desktop tests plus web API tests (84 total)
docs/                       Design, testing, evaluation, demonstration and web notes
sample-data/                Example availability CSV
```

## Documentation

- [Design and architecture](docs/DESIGN.md) — layers, class model, ER diagram, concurrency and event flows
- [Testing](docs/TESTING.md) — test inventory, acceptance-criteria coverage, results and defect log
- [Evaluation](docs/EVALUATION.md) — measured results, baseline comparison, threats to validity
- [Demo script](docs/DEMO.md) — setup checklist, live demonstration flow, slide outline
- [Report outline](docs/REPORT-OUTLINE.md) — suggested final-report structure and ethics statement

## Known Limitations

- Single-machine desktop application with a local SQLite file; no multi-device synchronisation.
- Notifications are in-app and file-based only; no SMS, email or push integration.
- Authentication is a course-level demo (PBKDF2 password hashes, simple roles), not production-grade identity management.
- Triage rules, bed counts and dispatch policies are simplified for the assignment.
- Automated tests cover services, DAOs, scheduling, concurrency, CSV and failure handling. JavaFX interaction is covered by a manual smoke test and the demo script rather than UI automation.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Unsupported class file major version` or JavaFX module error | Point `JAVA_HOME` at JDK 17+ and check `java -version` |
| Application exits before the window appears in a remote/headless shell | Run it from a normal desktop session; JavaFX needs a display |
| “Database problem” dialog | Ensure the working directory (or the configured `haes.db` folder) is writable; close other HAES instances |
| Stale demo data | Close the app and delete `haes.db*` and `emergency_audit.log` |
| CSV rows rejected | Check the four-column format, future dates and non-overlapping doctor times |

## Academic Use and Ethics

This project is submitted for **CSE 213**. It uses only invented sample accounts and records. Any user interviews or usability tests must follow the applicable consent and anonymisation requirements; do not insert real patient information into the application or the report.
