# HAES Testing Evidence

This document records how HAES was tested, what each test proves, how the
acceptance criteria are covered, and what was found and fixed during the final
test pass. It is written to be read alongside [DESIGN.md](DESIGN.md) and the
source under `src/test/java`.

> HAES is an academic simulation using invented data. The tests exercise
> scheduling and persistence behaviour, not clinical safety.

## 1. Test Strategy

The suite uses four complementary levels:

| Level | What it checks | How it is implemented |
| --- | --- | --- |
| Unit | Validation rules, password hashing, bed arithmetic | Plain JUnit 5 tests with no database |
| Integration | Services, DAOs, transactions, schema, CSV, composition root | Real SQLite database created in a JUnit `@TempDir` |
| Concurrency | Slot locking, transaction re-checks, bed uniqueness, dispatch order | Thread pools, `CountDownLatch` barriers, 50 simultaneous bookings |
| Failure / non-functional | Rollback, constraint handling, unreadable database, latency and race metrics | Fault-injection tests and `EvaluationTest` |

Every integration fixture owns a fresh temporary directory, a fresh
`haes.db`, and a fresh audit log. Tests never touch the developer database and
can run in any order. `TestFixture` is the single wiring point: it constructs
the same DAOs, services and schedulers that `AppContext` constructs in the real
application, so a passing service test is evidence about the shipped wiring.

The JavaFX screens are not driven by a UI automation tool. They are checked by
the manual script in Section 8 and by the live demonstration. This is a stated
limitation, not a hidden assumption.

## 2. Reproducing the Suite

Requirements: JDK 17 or newer and the included Maven Wrapper.

```bat
mvnw.cmd test
```

On macOS/Linux:

```bash
./mvnw test
```

Useful variants:

```bat
:: one class
mvnw.cmd test -Dtest=AppointmentServiceTest

:: one method
mvnw.cmd test -Dtest=AppointmentServiceTest#preemptedAppointmentCanBeRebooked

:: keep the SQLite fixtures for inspection
mvnw.cmd test -Dmaven.surefire.debug
```

Surefire writes one text and one XML report per class to
`target/surefire-reports/`. The console also prints the two evaluation lines
from `EvaluationTest`.

### Recorded execution

| Item | Value |
| --- | --- |
| Date | 31 October 2026 |
| Command | `mvnw.cmd test` (executed through the bundled Maven 3.9.9 distribution) |
| JDK | Microsoft OpenJDK 21.0.10+7-LTS, compiled with `--release 17` |
| JavaFX / SQLite | JavaFX 21.0.5 / sqlite-jdbc 3.45.3.0 |
| Result | **65 tests run, 0 failures, 0 errors, 0 skipped** |
| Build time | 13.3 s on the development laptop |
| Evaluation output | `attempts=50 successes=1 doubleBookings=0 elapsedMs=240`; `cases=8 avgLatencyMs=76 maxLatencyMs=112` |

Because the two evaluation tests measure wall-clock time, their numbers move
by a few milliseconds between runs (observed ranges: 206–240 ms for the booking
race and 76–83 ms average / 112–123 ms maximum for dispatch). The assertions,
not the printed numbers, are the stable pass criteria: exactly one booking and
a maximum dispatch latency below 1,000 ms.

## 3. Test Inventory

Twelve test classes contain 65 tests. `TestFixture` is a helper, not a test
class, which is why `src/test/java` contains 13 files.

| # | Test class | Tests | Primary area |
| --- | --- | ---: | --- |
| 1 | `dao.DatabaseFailureTest` | 7 | Schema creation, transactions, constraints, failure reporting |
| 2 | `EvaluationTest` | 2 | Measured concurrency and dispatch metrics |
| 3 | `scheduler.BedPoolTest` | 4 | ER bed uniqueness and capacity under concurrency |
| 4 | `service.AdminServiceTest` | 5 | Department and user CRUD, role creation, references |
| 5 | `service.AppointmentServiceTest` | 13 | Booking, conflict, reschedule, cancellation, pre-emption rebooking |
| 6 | `service.AuthServiceTest` | 7 | Login, registration, inactive accounts, password change |
| 7 | `service.ConcurrentBookingTest` | 1 | 50-thread race on a single slot |
| 8 | `service.EmergencyServiceTest` | 10 | Priority dispatch, lifecycle, escalation, pre-emption, beds |
| 9 | `ui.AppContextTest` | 2 | Bootstrap, demo roles, report export, CSV import |
| 10 | `util.CsvTest` | 4 | CSV parsing and RFC-4180-style export |
| 11 | `util.PasswordHasherTest` | 3 | PBKDF2 format, salting, fail-closed verification |
| 12 | `util.ValidationTest` | 7 | Field and range validation |
| | **Total** | **65** | |

### 3.1 Database and failure tests

`src/test/java/com/hospital/haes/dao/DatabaseFailureTest.java`

| ID | Test method | What it proves |
| --- | --- | --- |
| T-DB-01 | `createsNestedDatabaseFile` | Missing parent folders and a missing database file are created automatically. |
| T-DB-02 | `failedTransactionRollsBack` | A runtime failure inside a transaction leaves no partial row behind. |
| T-DB-03 | `successfulTransactionCommits` | A successful transaction is durable and visible to a later read. |
| T-DB-04 | `foreignKeyViolationFails` | Foreign keys are enabled on connections; an appointment for a missing patient is rejected. |
| T-DB-05 | `duplicateDepartmentFails` | Unique constraints surface as `DatabaseOperationException`, not raw SQL. |
| T-DB-06 | `unwritableLocationFails` | An unusable database location produces the typed database error used by the startup dialog. |
| T-DB-07 | `garbageDatabaseFileFails` | A non-SQLite file is rejected during schema initialisation instead of being silently corrupted. |

### 3.2 Appointment and concurrency tests

`src/test/java/com/hospital/haes/service/AppointmentServiceTest.java`

| ID | Test method | What it proves |
| --- | --- | --- |
| T-AP-01 | `booksAppointmentAndMarksSlotBooked` | A valid booking inserts a `BOOKED` appointment, marks the slot `BOOKED`, and notifies patient and doctor. |
| T-AP-02 | `rejectsDoubleBooking` | **AC-1:** a second booking of the same slot is rejected and the first appointment remains unchanged. |
| T-AP-03 | `rejectsOverlappingAppointmentForSamePatient` | A patient cannot hold two overlapping appointments, even in different slots. |
| T-AP-04 | `allowsBackToBackAppointments` | A booking starting exactly when another ends is allowed (boundary case). |
| T-AP-05 | `enforcesActiveAppointmentLimit` | The per-patient limit (default 3) blocks hoarding with a clear error. |
| T-AP-06 | `cancelFreesSlot` | Cancelling writes `CANCELLED`, frees the slot, and notifies both parties. |
| T-AP-07 | `rescheduleMovesBookingAndFreesOldSlot` | Rescheduling creates a replacement, marks the old appointment `RESCHEDULED`, and frees the old slot atomically. |
| T-AP-08 | `rescheduleRejectsOverlap` | Rescheduling cannot create a patient overlap or take a non-free slot. |
| T-AP-09 | `patientCannotManageAnotherPatientsAppointment` | Role/ownership checks prevent a patient from cancelling someone else’s appointment. |
| T-AP-10 | `rejectsPastSlot` | A slot whose start time has passed cannot be booked. |
| T-AP-11 | `defineAvailabilityUsesValidationRules` | Availability is future-only, doctor-only, correctly ordered, and overlap-free. |
| T-AP-12 | `preemptedAppointmentCanBeRebooked` | A `PRE_EMPTED` appointment can be moved to a new slot; the old record becomes `RESCHEDULED` and leaves the waitlist. |
| T-AP-13 | `onlyFreeSlotsCanBeRemoved` | A booked slot cannot be deleted from under an active appointment. |

`src/test/java/com/hospital/haes/service/ConcurrentBookingTest.java`

| ID | Test method | What it proves |
| --- | --- | --- |
| T-CC-01 | `onlyOneConcurrentBookingWins` | **NFR-1 / AC-1:** 50 threads released together, all booking the same slot, produce exactly one success and 49 `SlotConflictException`s. |

### 3.3 Emergency tests

`src/test/java/com/hospital/haes/service/EmergencyServiceTest.java`

| ID | Test method | What it proves |
| --- | --- | --- |
| T-EM-01 | `raisePersistsCaseAndAuditTrail` | Raising a case stores the case, a `RAISED` event, an audit line, and a notification. |
| T-EM-02 | `validatesEmergencyInput` | Empty location, invalid severity/type and bad patient references are rejected before storage. |
| T-EM-03 | `dispatchAssignsResponderAndBed` | Dispatch assigns a matching responder, reserves a bed, writes `DISPATCHED`, and timestamps it. |
| T-EM-04 | `priorityOrderIsRespected` | **AC-2:** Critical is dispatched before High before Medium, regardless of raise order. |
| T-EM-05 | `acknowledgeAndResolveLifecycle` | Only the assignee can acknowledge; resolution requires an active assignment, writes `RESOLVED`, and releases the bed. |
| T-EM-06 | `escalationReassignsToAlternateResponder` | **AC-3:** an unacknowledged case past the timeout is reassigned to a free alternate and an `ESCALATED` event/audit line is written. |
| T-EM-07 | `escalationWithoutAlternateKeepsResponder` | With no alternate, the case is still escalated, the duty head is warned, and the responder is not silently lost. |
| T-EM-08 | `criticalPreemptsInProgressAppointment` | **AC-6:** a Critical case with no free doctor pre-empts an in-progress routine appointment, frees its slot, notifies the patient, and adds it to the waitlist. |
| T-EM-09 | `nonCriticalDoesNotPreempt` | A High case waits instead of disrupting a routine consultation. |
| T-EM-10 | `exhaustedBedsDelayDispatch` | When all beds are occupied, dispatch leaves the case `WAITING`; releasing a bed allows it to be assigned. |

`src/test/java/com/hospital/haes/scheduler/BedPoolTest.java`

| ID | Test method | What it proves |
| --- | --- | --- |
| T-BP-01 | `acquiresUniqueBedsUntilCapacity` | Beds are unique and acquisition stops exactly at capacity. |
| T-BP-02 | `reservePreassignedBeds` | Rebuilding the pool from occupied beds is safe and idempotent. |
| T-BP-03 | `validatesCapacityAndBedNumbers` | Invalid capacities and out-of-range bed numbers are rejected. |
| T-BP-04 | `concurrentAcquisitionIsUnique` | Concurrent threads can never receive the same bed. |

### 3.4 Account, administration and validation tests

`src/test/java/com/hospital/haes/service/AuthServiceTest.java`

| ID | Test method | What it proves |
| --- | --- | --- |
| T-AU-01 | `loginSucceedsForActiveUser` | A valid active account signs in and returns the correct role object. |
| T-AU-02 | `loginIsUsernameCaseInsensitive` | Usernames are normalised consistently. |
| T-AU-03 | `loginRejectsBadCredentials` | Wrong, unknown and blank credentials are rejected with the same safe message. |
| T-AU-04 | `inactiveUserCannotLogin` | Deactivation blocks login without deleting audit history. |
| T-AU-05 | `registerPatientCreatesUsableAccount` | Self-registration stores a PBKDF2 hash and the new account can sign in. |
| T-AU-06 | `registerRejectsInvalidInput` | Duplicate usernames and invalid fields are rejected. |
| T-AU-07 | `changePasswordRequiresCurrentPassword` | The current password is required and the old password stops working. |

`src/test/java/com/hospital/haes/service/AdminServiceTest.java`

| ID | Test method | What it proves |
| --- | --- | --- |
| T-AD-01 | `departmentCrud` | Departments can be created, renamed, listed and removed when empty. |
| T-AD-02 | `departmentWithUsersCannotBeDeleted` | Referential integrity prevents deleting a department that still has users. |
| T-AD-03 | `createsUsersForEveryRole` | Admin can create Patient, Doctor, Receptionist, ER Staff and Admin accounts; responders are listed for dispatch. |
| T-AD-04 | `updatesUserAndPassword` | Details and password can be updated; the new password works. |
| T-AD-05 | `deleteUserRespectsReferences` | Unreferenced users can be deleted; users referenced by appointments/emergencies are protected. |

`src/test/java/com/hospital/haes/util/ValidationTest.java`

| ID | Test method | What it proves |
| --- | --- | --- |
| T-VA-01 | `usernamesAreValidated` | Allowed characters and length limits are enforced. |
| T-VA-02 | `passwordsAreValidated` | Passwords must be 6–128 characters. |
| T-VA-03 | `phonesAreValidated` | Optional phone fields are still checked when supplied. |
| T-VA-04 | `ageIsValidated` | Age accepts only 0–120. |
| T-VA-05 | `timeRangesAreValidated` | A slot must be positive and at most 8 hours. |
| T-VA-06 | `futureDatesAreValidated` | Past and null date/time values are rejected. |
| T-VA-07 | `requiredTextAndLengthsAreValidated` | Required text and maximum lengths are enforced. |

### 3.5 Persistence, CSV, security and integration tests

`src/test/java/com/hospital/haes/util/CsvTest.java`

| ID | Test method | What it proves |
| --- | --- | --- |
| T-CS-01 | `importsValidSlotRows` | Headers, comments, blank lines, quoted values and flexible times (`9:30` / `09:30`) are parsed. |
| T-CS-02 | `rejectsMalformedRows` | Malformed rows fail with a useful line number. |
| T-CS-03 | `exportsAppointmentsWithQuoting` | Appointment export quotes commas/quotes correctly and includes joined slot/doctor details. |
| T-CS-04 | `exportsEmergenciesAndSlots` | Emergency and availability exports handle nullable fields. |

`src/test/java/com/hospital/haes/util/PasswordHasherTest.java`

| ID | Test method | What it proves |
| --- | --- | --- |
| T-SE-01 | `hashAndVerify` | Hashes use the documented PBKDF2 format and verify the correct password. |
| T-SE-02 | `hashesAreSalted` | Equal passwords produce different stored hashes. |
| T-SE-03 | `malformedHashesFailClosed` | Missing or malformed stored hashes never authenticate. |

`src/test/java/com/hospital/haes/ui/AppContextTest.java`

| ID | Test method | What it proves |
| --- | --- | --- |
| T-IN-01 | `bootstrapSeedsDemoData` | A fresh database is seeded; every documented demo account can sign in with its role; appointment and emergency CSV exports succeed. |
| T-IN-02 | `csvImportAddsAvailability` | The reporting facade imports the sample availability format against seeded doctor accounts. |

### 3.6 Evaluation harness

`src/test/java/com/hospital/haes/EvaluationTest.java`

| ID | Test method | What it proves |
| --- | --- | --- |
| T-EV-01 | `bookingRaceMetrics` | 50 simultaneous patients produce one success, one persisted appointment row, zero double bookings, and a measured elapsed time. |
| T-EV-02 | `dispatchLatencyMetrics` | Eight mixed-severity cases are dispatched to eight doctors; average and maximum raise-to-dispatch latency are measured and the maximum is asserted below 1,000 ms. |

These two tests are also assertions, not just reports: `assertEquals(1, successes)`,
`assertEquals(1, persisted.size())`, and `assertTrue(maxMillis < 1_000)` make
the measured targets part of the build.

## 4. Acceptance-Criteria Matrix

| AC | Requirement | Automated evidence | Manual/UI evidence | Status |
| --- | --- | --- | --- | --- |
| AC-1 | A second booking of a taken slot is rejected and the database is unchanged. | `T-AP-02`, `T-CC-01`, `T-EV-01`; 49 rejection paths, one row in SQLite. | Book the same slot for two patients from the reception screen; the second shows a slot-conflict dialog. | **Pass** |
| AC-2 | Critical is dispatched before Medium when both are queued. | `T-EM-04` asserts the persisted dispatch order; `T-EV-02` mixes severities. | Raise a Medium then a Critical case; the board orders Critical first and dispatch assigns it first. | **Pass** |
| AC-3 | An unacknowledged case past the timeout escalates, with a timestamped log entry. | `T-EM-06` and `T-EM-07`; event and audit assertions. | Raise a case, do not acknowledge for 30 s, then inspect the timeline and `emergency_audit.log`. | **Pass** |
| AC-4 | Missing/locked database shows a friendly error and recovers or exits cleanly. | `T-DB-01`, `T-DB-06`, `T-DB-07`; `T-DB-02` rollback. Startup alert is in `Main`. | Launch with an unwritable/corrupt database path; the “Database problem” alert appears and the app exits without a stack-trace crash. A locked-file case relies on the 5 s busy timeout and the same typed error path. | **Pass, with locked-file check manual** |
| AC-5 | Invalid input (past date, empty location, invalid age) blocks submission with a clear message. | `T-VA-01`–`T-VA-07`, `T-EM-02`, `T-AP-10`, `T-AP-11`. | Submit empty reason/location, invalid phone/age, and a past date; each form stays open and explains the problem. | **Pass** |
| AC-6 | A Critical case with no free doctor pre-empts a routine appointment, marks it pre-empted and notifies the patient. | `T-EM-08`; `T-AP-12` proves the affected patient can rebook. | Automated evidence is the primary proof; the board/notification/waitlist can be inspected after the test or with a seeded in-progress appointment. | **Pass** |

## 5. Non-Functional Requirements

| NFR | Target | Evidence | Result |
| --- | --- | --- | --- |
| NFR-1 Correctness under concurrency | 0 double bookings with 50 simultaneous attempts | `T-CC-01`, `T-EV-01`: exactly 1 success and exactly 1 persisted row; per-slot lock plus transaction re-check | **Met** |
| NFR-2 Emergency responsiveness | Dispatch under 1 s | `T-EV-02`: 76 ms average, 112 ms maximum in the recorded run; assertion `< 1,000 ms` | **Met** |
| NFR-3 Usability | New patient books in under 60 s | Manual script only; no human participant study was executed for this submission | **Not yet measured** |
| NFR-4 Reliability | Friendly database error, no crash | `T-DB-01`–`T-DB-07`; `Main` catches `DatabaseOperationException` and shows an alert | **Met at service/startup level** |
| NFR-5 Data integrity | Foreign keys on, prepared statements only | `T-DB-04`, `T-DB-05`; schema constraints; DAO review uses `PreparedStatement` throughout | **Met** |
| NFR-6 Maintainability | Layered packages, no business logic in UI | Package map in [DESIGN.md](DESIGN.md); views call services only | **Met** |
| NFR-7 Privacy and ethics | Invented data only, no real identifiers | `SampleData` contains invented accounts; no diagnosis/billing fields; ethics statement in [REPORT-OUTLINE.md](REPORT-OUTLINE.md) | **Met for the simulation; user-study consent still required if interviews are added** |

NFR-3 is deliberately not marked as met. The PRD requires a small user test,
and no real participants were involved in this build. Section 8 gives the
manual protocol that can produce that evidence; the report should either run it
or state the limitation explicitly.

## 6. Concurrency Evidence

### 6.1 The 50-thread booking race

`ConcurrentBookingTest` and `EvaluationTest` use the same structure:

1. Create one 30-minute future slot for one doctor.
2. Create 50 distinct patient accounts.
3. Submit 50 tasks to a fixed pool of 50 threads.
4. Each task waits on a shared `CountDownLatch`, then calls
   `AppointmentService.book(patientId, slotId, "race")`.
5. A `SlotConflictException` counts as a correct rejection; any other result is
   a failure.
6. After all futures complete, count persisted rows for that slot.

Observed result: 1 success, 49 rejections, 1 appointment row, 0 double
bookings. The database slot ends in `BOOKED`.

Why the result is expected:

- `SlotLockManager` gives each slot id a fair `ReentrantLock`; the
  check-then-insert sequence is inside that lock.
- `DatabaseManager` serialises write transactions behind a fair lock; SQLite
  itself provides the durable constraint.
- The transaction re-reads the slot and requires `FREE` before updating and
  inserting, so even a caller that passed the first pre-check cannot win twice.
- The `UNIQUE (doctor_id, start_time)` slot constraint and the one-row status
  update provide a final backstop.

### 6.2 What the race does and does not prove

It proves correctness for one JVM, one SQLite file, and 50 callers contending
for one slot. It does not prove behaviour for multiple application processes,
a network database, or a slot-sharing policy across hospitals. Those are
outside the desktop simulation’s scope and are listed as limitations in
[EVALUATION.md](EVALUATION.md).

## 7. Defect Log

The following defects were found during implementation and final verification.
Each one has a regression test or an explicit manual check.

| ID | Symptom | Root cause | Fix | Regression evidence |
| --- | --- | --- | --- | --- |
| D-01 | A valid availability CSV was rejected because the header row was treated as a slot. | Header detection did not consistently skip the first row, including case/whitespace variants. | Case-insensitive header skip plus blank/comment handling. | `T-CS-01`, `T-IN-02` |
| D-02 | Creating or editing a user could fail when optional fields were blank. | Dialog values were parsed without null/blank guards. | Trim and null-safe parsing for optional phone, department and metadata fields. | `T-AD-03`, `T-AD-04` |
| D-03 | The emergency dialog showed a duplicate action button. | The button was added twice while wiring the dialog footer. | Single footer button and one handler. | Manual UI checklist |
| D-04 | A Critical case did not pre-empt a doctor who was in an active consultation. | Responder search treated the busy doctor as unavailable without entering the pre-emption branch. | Explicitly find the in-progress appointment and invoke `preEmptForEmergency` for Critical cases. | `T-EM-08` |
| D-05 | A pre-empted appointment could not be rescheduled. | Reschedule accepted only `BOOKED` records. | Accept `PRE_EMPTED`, create the replacement, mark the old record `RESCHEDULED`, and remove it from the waitlist. | `T-AP-12` |
| D-06 | Pre-emption returned an appointment whose in-memory status was still `BOOKED`. | The method returned the entity read before the SQL status update. | Update the returned entity (and its slot status) before returning it. | `T-AP-12` |

All six are closed in the current build. D-03 is intentionally manual because
it is a pure JavaFX layout issue; the service layer has no duplicate-side-effect
path to assert.

## 8. Manual UI Checklist

Run this after `mvnw.cmd test` passes and before a demonstration. Use a fresh
database unless a step says otherwise.

| # | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| U-01 | Clean start | Delete `haes.db*` and `emergency_audit.log`, then `mvnw.cmd javafx:run`. | Login window appears; a new database and audit file are created; no startup exception. |
| U-02 | Bad login | Enter a wrong password, then an unknown username. | Clear “invalid credentials” message; no crash; password field can be retried. |
| U-03 | Role tabs | Sign in as each demo account. | Patient sees Book/My appointments/My emergencies; Doctor sees Schedule/Availability/Emergencies; Receptionist sees Book/All/Re-book/Emergency board; ER Staff sees Emergency board/All appointments; Admin sees Users/Departments/Appointments/Re-book/Emergency board/Reports. |
| U-04 | Patient booking | As `patient.anita`, choose a department/date, select a free slot, enter a reason, confirm. | Confirmation dialog, success notification, appointment appears under “My appointments”, slot becomes unavailable. |
| U-05 | Validation | Try an empty reason, a past date, and an invalid phone/age in the relevant forms. | Submission is blocked with a specific message; the app remains usable. |
| U-06 | Double booking | As reception, try to book a slot already booked by another patient. | Slot-conflict message; the existing appointment is unchanged. |
| U-07 | Reschedule and cancel | Move a booking to another free slot, then cancel another booking. | Old slot is freed; replacement is shown; cancellation notification appears; the slot becomes bookable again. |
| U-08 | Doctor availability | As `dr.sharma`, add a future slot and try an overlapping slot. | First slot is listed; overlap is rejected with a clear message. |
| U-09 | Doctor completion | As the assigned doctor, mark an appointment completed and another no-show. | Status changes; slot is freed; patient notification is generated. |
| U-10 | Raise emergency | Press the red **EMERGENCY** button, choose type/severity/location, submit. | Case is created in under three clicks; confirmation shows the queue state; ER board updates. |
| U-11 | Dispatch and acknowledge | Open the emergency board as ER staff or doctor; wait for auto-dispatch or press **Dispatch now**. | A responder and bed are assigned; the timeline contains `RAISED` and `DISPATCHED`; the assigned doctor can acknowledge. |
| U-12 | Resolve | As the assignee/authorised role, resolve with a note. | `RESOLVED` event, bed released, notification shown. |
| U-13 | Escalation | Raise a case, do not acknowledge for 30 s, keep the board open. | Status becomes escalated; `ESCALATED` event and audit line appear; a new responder or duty-head warning is shown. |
| U-14 | Critical pre-emption | Automated test is authoritative. If staged manually with an in-progress appointment, raise Critical when no doctor is free. | Appointment becomes `PRE_EMPTED`, slot is freed, patient gets a Critical notification, case appears in Re-book queue. |
| U-15 | Bed exhaustion | Automated test is authoritative. For a manual check, fill all eight beds and raise another case. | Case remains `WAITING` with a visible status; resolving a bed allows dispatch. |
| U-16 | Reports and audit | File → export appointments and emergencies; import `sample-data/availability.csv`; open the audit log. | CSV files open in a spreadsheet; import reports the count; audit text contains timestamped lifecycle lines. |
| U-17 | Database failure | Launch with `-Dhaes.db` pointing at an unwritable/corrupt location. | Friendly “Database problem” alert, then a clean exit; no unhandled stack trace in the UI. |
| U-18 | Logout and re-login | Log out, sign in as a different role. | Notification listeners are disposed; the new role sees only its tabs; no duplicate notifications. |

### UI check record

| Date | Build | Result | Notes |
| --- | --- | --- | --- |
| 31 October 2026 | Final local build | Pass | JavaFX smoke launch ran for 25 s with no startup exception; full interactive pass should be repeated on the presentation machine. |

## 9. Known Testing Gaps

- No TestFX or other UI automation; screen behaviour is verified manually.
- The locked-database variant of AC-4 is not automated. The app uses a 5 s
  SQLite busy timeout and converts the failure into `DatabaseOperationException`;
  the friendly dialog is checked manually.
- The evaluation uses one machine and one SQLite file. It does not model a
  network, multiple app instances, or hospital-scale data.
- NFR-3 needs a consented, anonymised user test; see the protocol below.
- Stress coverage is 50 booking threads and 8 emergency cases. It is enough to
  demonstrate the mechanisms, not to certify production capacity.

## 10. User-Test Protocol for NFR-3 (Pending)

If the report will claim NFR-3, run this short, consent-based protocol:

1. Recruit 3–5 participants who are not team members (for example classmates
   role-playing a patient). Record written/recorded consent.
2. Give a two-minute orientation to the login and the task only, not to the
   slot table or the reason field.
3. Task: “Sign in as the patient account, book any available appointment, and
   point to the confirmation.” Start a stopwatch at “go” and stop when the
   confirmation is visible.
4. Record seconds, whether the participant succeeded unaided, and any
   confusion comment. Do not record names, phone numbers, or real medical data.
5. Report median and range, not just the best time. Target: median under 60 s.
6. Add a 5-point satisfaction question and report the anonymised mean.
7. Store consent forms separately from the report and refer to participants as
   P1, P2, P3, etc.

Until this is run, the report must say that NFR-3 is designed-for but not
measured.
