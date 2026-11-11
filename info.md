# HAES — Project Information

> Single-file reference for the end-semester report. Compiled 2026-11-11 from
> `README.md`, the PRD, `docs/*`, `pom.xml`, `src/`, and the git history.
> HAES is an **academic simulation with invented data** — not a clinical system.

## 1. Project Identity

| Item | Value |
| --- | --- |
| Name | HAES — Hospital Appointment & Emergency Scheduler |
| Course | CSE 213 Integrated Java Project |
| Team size | 4 members |
| Repository | [github.com/mevarx/JAVA-End-sem-project](https://github.com/mevarx/JAVA-End-sem-project) |
| Version | 1.0.0 (`com.hospital:haes`) |
| Type | Desktop simulation (JavaFX) + REST/web layer in progress |
| Status | Working desktop app; web module uncommitted WIP |

**One-line summary:** a desktop simulation of the two scheduling problems a
hospital handles simultaneously — planned outpatient appointments (conflict-free
booking) and unplanned emergencies (priority dispatch, escalation, Critical
pre-emption, shared ER bed pool).

## 2. Problem & Goals

**Problems addressed:** manual registers double-book slots; patients can't see
doctor availability; emergencies taken by phone/paper have no consistent priority
or response-time record; no audit trail; doctors pulled to emergencies leave
outpatients uninformed.

**Goals:** (1) conflict-free concurrent booking; (2) severity-prioritised
emergency dispatch within a measurable time; (3) auto-escalation of
unacknowledged cases; (4) full SQLite persistence with CRUD; (5) usable JavaFX UI
with emergency visual cues; (6) measurable improvement over a manual FCFS baseline.

**Non-goals:** no real SMS/email/push, no web/mobile client (web layer now WIP —
see §12), no HIS integration, no diagnosis/billing, no production-grade auth.

## 3. Technology Stack

| Layer | Technology |
| --- | --- |
| Language | Java 17 target (`maven.compiler.release=17`), verified on Microsoft OpenJDK 21.0.10 |
| Desktop UI | JavaFX 21.0.5 (programmatic, no FXML) |
| Database | SQLite via `org.xerial:sqlite-jdbc:3.45.3.0`, WAL mode, `PreparedStatement` only |
| Web (WIP) | Spring Boot 3.5.16 (`spring-boot-starter-web`, `-validation`) on port 8080 |
| Tests | JUnit Jupiter 5.10.2, Surefire 3.2.5, spring-boot-starter-test |
| Build | Maven 3.9.9 via included Wrapper (`mvnw` / `mvnw.cmd`); `run-mvn.bat` pins JDK 21 on Windows |
| Security | PBKDF2-HMAC-SHA256, random 16-byte salt, 65,536 iterations |
| Frontend ref | `frontend.dir` property + Node v24.14.1 property exist in POM (no `frontend/` dir yet) |

## 4. Codebase Size (measured 2026-11-11)

| Metric | Value |
| --- | --- |
| Java files | 119 total — 106 main, 13 test |
| Lines of Java | ~11,274 |
| Test classes | 12 (+ `TestFixture` helper) |
| Tests | 65, 0 failures, 0 errors (recorded run 31 Oct 2026, build 13.3 s) |
| Packages | `model`, `service`, `scheduler`, `dao`, `exception`, `util`, `ui`, `web` (WIP) |
| Resources | `db/schema.sql`, `css/app.css`, `application.yml` (web) |
| Docs | `README.md`, PRD, `docs/` (DESIGN, TESTING, EVALUATION, DEMO, REPORT-OUTLINE) |

## 5. Architecture

Layered desktop app: **JavaFX UI → services → scheduler/DAO → SQLite**, with a
thread-safe notification event bus and an append-only audit file as side channels.

```text
com.hospital.haes
├─ Main                     JavaFX entry point + DB bootstrap
├─ model        User (abstract → Patient, Doctor, Receptionist, ErStaff, Admin),
│               Booking (abstract → Appointment, EmergencyCase),
│               Department, Slot, Notification, EmergencyEvent,
│               interfaces Schedulable / Notifiable / Auditable,
│               enums Role, SlotStatus, AppointmentStatus, EmergencyType,
│               Severity, EmergencyStatus, NotificationLevel
├─ service      AuthService, UserService, DepartmentService,
│               AppointmentService, EmergencyService,
│               NotificationService, ReportingService
├─ scheduler    PriorityScheduler<T>, EmergencyDispatcher,
│               EscalationTimer, SlotLockManager, BedPool
├─ dao          Repository<T,ID>, DatabaseManager, UserDao, DepartmentDao,
│               SlotDao, AppointmentDao, EmergencyDao, SampleData
├─ exception    SlotConflictException, InvalidBookingException,
│               UnauthorizedActionException, ValidationException,
│               NoResourceAvailableException, EmergencyEscalationException,
│               DatabaseOperationException
├─ util         Validator, PasswordHasher, CsvImporter, CsvExporter,
│               FileLogger, Result<T>
├─ ui           AppContext (composition root), MainWindow, LoginView,
│               EmergencyDialog, UiUtils + role views
│               (booking, availability, appointments, emergency board,
│               waitlist, doctor schedule, reports, admin)
└─ web (WIP)    WebApplication, HealthController, AppConfig,
│               EmergencyLifecycle, HaesProperties, 27 DTO/request classes
```

**Key design decisions:**
- Booking = per-slot fair `ReentrantLock` + SQLite transaction that **re-reads**
  the slot and requires `FREE` before insert; writes serialised behind a fair
  lock in `DatabaseManager`. Reschedule locks both slot ids in ascending order
  (deadlock-free).
- Emergencies = `PriorityBlockingQueue` ordered by **severity → arrival time →
  id**; background `EmergencyDispatcher` assigns matching on-call doctor/ER staff
  + bed; bed acquired *before* responder so a case never holds a doctor without a bed.
- Escalation = `ScheduledExecutorService` scan (default 30 s ack timeout);
  reassigns to a free alternate or warns the duty head; every event timestamped
  in `emergency_events` + `emergency_audit.log`.
- Pre-emption = **Critical-only**, only when no free doctor; appointment →
  `PRE_EMPTED`, slot freed, patient notified, entry added to generic
  `PriorityScheduler<Appointment>` waitlist.
- Beds = `Semaphore` + unique bed-number queue; concurrent acquisition test
  proves no double-assignment.
- Generics: `Repository<T,ID>`, `Result<T>`, `PriorityScheduler<T extends
  Schedulable & Comparable<T>>` (reused for emergencies and the waitlist).
- UI is presentation-only; all SQL in `dao`, all rules in `service`.
- JavaFX updates marshalled via `Platform.runLater`; background threads never
  touch controls directly.

## 6. Database Schema (`haes.db`, from `db/schema.sql`)

6 tables: `departments`, `users`, `slots`, `appointments`, `emergencies`,
`emergency_events`, plus 5 indexes. Timestamps stored as ISO-8601 text.

Integrity: `PRAGMA foreign_keys=ON` on **every** connection,
`PRAGMA busy_timeout=5000`, unique `users.username` / `departments.name`,
`UNIQUE (doctor_id, start_time)` on slots, `CHECK` constraints on all status
enums, `ON DELETE RESTRICT` for appointments, `SET NULL`/`CASCADE` elsewhere.

Appointment statuses: `BOOKED, COMPLETED, CANCELLED, NO_SHOW, RESCHEDULED,
PRE_EMPTED`. Emergency statuses: `WAITING, ASSIGNED, ACKNOWLEDGED, ESCALATED,
RESOLVED`. Severities: `CRITICAL, HIGH, MEDIUM`. Types: `CARDIAC, TRAUMA,
RESPIRATORY, STROKE, OTHER`.

Seed data on first launch: 6 departments, 10 demo users, up to 140 future slots,
1 demo appointment, 1 historical resolved emergency.

## 7. Features (FR-1…FR-20 coverage)

| Area | Behaviour |
| --- | --- |
| Accounts | Login, role-based tabs, patient self-registration, password change, admin user CRUD |
| Availability | Doctor/admin defines future slots; overlaps rejected; free slots removable |
| Booking | Free-slot booking; conflict/overlap/active-limit (default 3) enforced |
| Appointments | View, reschedule, cancel, complete, no-show, pre-emption waitlist |
| Emergencies | Raise by type/severity/location; priority dispatch; bed assignment; acknowledge; resolve; escalation |
| Notifications | In-app event feed (confirmations, cancellations, pre-emption, emergency events) |
| Reports | Appointment/emergency CSV export; availability CSV import (`sample-data/availability.csv`) |
| Audit | Append-only `emergency_audit.log` + `emergency_events` table |
| Admin | Departments + users, role validation, doctor specialization/on-call metadata |

Emergency raisable in ≤3 clicks from the red header button (FR-15).

## 8. Users & Demo Accounts

Roles: Patient, Doctor, Receptionist, ER Staff, Admin.

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `admin123` |
| Receptionist | `reception` | `reception123` |
| Doctor (Cardiology) | `dr.sharma` | `doctor123` |
| Doctor (Orthopedics) | `dr.rao` | `doctor123` |
| Doctor (Pulmonology) | `dr.iyer` | `doctor123` |
| Doctor (Neurology) | `dr.khan` | `doctor123` |
| Doctor (General Med.) | `dr.nair` | `doctor123` |
| ER Staff | `er.patel` | `er123` |
| Patient | `patient.anita` | `patient123` |
| Patient | `patient.rahul` | `patient123` |

## 9. Requirements Traceability

**Acceptance criteria:** AC-1 (slot conflict rejected, DB unchanged) → T-AP-02,
T-CC-01, T-EV-01 ✅; AC-2 (Critical dispatched first) → T-EM-04 ✅; AC-3
(escalation + timestamped log) → T-EM-06/07 ✅; AC-4 (DB failure → friendly
error) → T-DB-01/02/06/07 ✅ (locked-file case manual); AC-5 (invalid input
blocked) → T-VA-01…07, T-EM-02, T-AP-10/11 ✅; AC-6 (Critical pre-emption +
notify) → T-EM-08, T-AP-12 ✅.

**Non-functional results (recorded 31 Oct 2026):**

| NFR | Target | Result |
| --- | --- | --- |
| NFR-1 concurrency | 0 double bookings (50-way race) | ✅ 1 success, 1 row, 0 doubles (240 ms) |
| NFR-2 dispatch latency | < 1,000 ms | ✅ 76 ms avg, 112 ms max |
| NFR-3 usability | booking < 60 s | ⏳ not measured — needs consented user study |
| NFR-4 reliability | friendly DB error, no crash | ✅ 7/7 failure tests |
| NFR-5 integrity | FK on, prepared statements | ✅ |
| NFR-6 maintainability | layered, no logic in UI | ✅ |
| NFR-7 privacy/ethics | invented data only | ✅ (consent still needed for user studies) |

**Rubric map (100 marks):** requirements 10, OOP 15, exceptions 10, threads/I/O
15, JDBC/collections 15, generics/JavaFX 15, testing 10, demo/report 10 —
full mapping in PRD §14 and `docs/REPORT-OUTLINE.md` §4.

## 10. Test Inventory (65 tests, 12 classes)

| Class | Tests | Area |
| --- | --- | --- |
| `dao.DatabaseFailureTest` | 7 | Schema, transactions, constraints, failure reporting |
| `EvaluationTest` | 2 | Booking-race + dispatch-latency metrics (`[EVAL]` lines) |
| `scheduler.BedPoolTest` | 4 | Bed uniqueness/capacity incl. concurrency |
| `service.AdminServiceTest` | 5 | Department/user CRUD, roles, references |
| `service.AppointmentServiceTest` | 13 | Booking lifecycle, conflicts, reschedule, pre-empt rebook |
| `service.AuthServiceTest` | 7 | Login, registration, deactivation, password change |
| `service.ConcurrentBookingTest` | 1 | 50-thread race on one slot |
| `service.EmergencyServiceTest` | 10 | Priority, lifecycle, escalation, pre-emption, beds |
| `ui.AppContextTest` | 2 | Bootstrap seeding, CSV import/export |
| `util.CsvTest` | 4 | CSV parse + RFC-4180-style export |
| `util.PasswordHasherTest` | 3 | PBKDF2 format, salting, fail-closed |
| `util.ValidationTest` | 7 | Field/range validation |

Fixtures use a fresh `@TempDir` SQLite DB per test via `TestFixture` (same
wiring as `AppContext`). JavaFX covered by manual smoke checklist
(`docs/TESTING.md` §8), not UI automation. Defect log in `docs/TESTING.md` §7.

## 11. How to Run

```bat
:: desktop app (Windows)              ./mvnw javafx:run      (macOS/Linux)
mvnw.cmd javafx:run
:: tests (prints [EVAL] metrics)
mvnw.cmd test
:: reset demo: delete haes.db* + emergency_audit.log, relaunch
```

System properties `haes.db` / `haes.audit` override default paths. First launch
creates `haes.db` + `emergency_audit.log`, applies schema, seeds demo data.

## 12. Web Module (uncommitted WIP — `git status` shows `M pom.xml`, `?? web/`)

Spring Boot 3.5.16 REST layer started after the last commit: `WebApplication`,
`HealthController` (health endpoint only), `AppConfig`, `EmergencyLifecycle`
(auto-start dispatcher), `HaesProperties` (`haes.db`, `haes.audit`,
`haes.emergency.auto-start`), `application.yml` (port 8080, graceful shutdown,
Jackson ISO dates, SSE-friendly, 5 MB uploads), and 27 DTO/request classes
(users, auth, slots, appointments, emergencies, events, notifications, board,
stats, reports, audit, dispatch results, limits, errors). No business
controllers yet — the JavaFX desktop app remains the functional UI.

## 13. Git History

| Commit | Message |
| --- | --- |
| `782cc97` | Add HAES project with updated README |
| `1d9be2c` | Fix scheduling and authorization bugs, refresh the UI |

Uncommitted: `pom.xml` (Spring Boot parent/deps), `run-mvn.bat`, `.claude/`,
`web/` package, `application.yml`.

## 14. Documents & Report Pointers

| Document | Contents |
| --- | --- |
| `README.md` | Quick start, accounts, feature map, structure, limitations, troubleshooting |
| PRD (`PRD Hostel Appointment and Emergency Scheduler (CSE 213).md`) | FR-1…FR-20, NFR-1…NFR-7, AC-1…AC-6, architecture, team model, rubric map |
| `docs/DESIGN.md` | Layers, class/ER/sequence Mermaid diagrams, concurrency, trade-offs |
| `docs/TESTING.md` | Test inventory (T-DB/AP/CC/EM/BP/AU/AD/VA/CS/SE/IN/EV), AC matrix, defect log, manual + user-test protocols |
| `docs/EVALUATION.md` | Methods, recorded numbers, baseline comparison, threats to validity |
| `docs/DEMO.md` | 8–10 min run sheet, click paths, screenshot checklist (S-01…S-15), slide outline, Q&A |
| `docs/REPORT-OUTLINE.md` | Chapter structure, figures/tables list, claims→evidence checklist, ethics template |
| This file (`info.md`) | Consolidated project fact sheet for the report |

## 15. Known Limitations (state these in the report)

Single-machine desktop app, local SQLite, no multi-device sync; in-app/file
notifications only; demo-grade auth; simplified triage; synthetic small
workload; no JavaFX automation; NFR-3 usability unmeasured; locked-DB dialog
checked manually; web layer incomplete.

## 16. Ethics Statement (short)

Academic simulation; all accounts/appointments/emergencies/locations invented;
no real patient identifiers, diagnoses, or billing data; no HIS accessed; any
user studies require written/recorded consent, anonymisation (P1, P2, …), and
separate storage of consent forms; no clinical claims; must not be used for
patient care.
