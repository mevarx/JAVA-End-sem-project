# HAES Demonstration Script

A practical 8–10 minute demonstration for CSE 213. The aim is to show the two
engineering ideas that make HAES different from a CRUD app: **conflict-free
concurrent booking** and **priority emergency dispatch with escalation and
pre-emption**. The UI is a demonstration surface; the evidence is in the
behaviour, the database, the audit log and the tests.

> Use invented demo accounts only. Do not enter real patient information
> during the demonstration.

## 1. Before the Demo

### 1.1 Machine checklist

- JDK 17 or newer is installed and `JAVA_HOME` points at it.
- The room has a desktop display; JavaFX needs a graphical session.
- The project folder is writable (SQLite creates `haes.db` and
  `emergency_audit.log` there).
- No other HAES instance is running against the same database.
- Screen resolution is at least 1280×800; the window minimum is 1120×700.
- Sound/notifications are not required.

### 1.2 Build and reset

Open a terminal in the project folder:

```bat
mvnw.cmd test
```

Confirm the last line says `Tests run: 65, Failures: 0, Errors: 0, Skipped: 0`.
Keep this terminal visible for the evaluation slide.

For a clean demo database:

```bat
del haes.db haes.db-shm haes.db-wal emergency_audit.log
mvnw.cmd javafx:run
```

The first launch creates the schema, seeds six departments, ten demo users,
up to 140 future slots, one demo appointment and one historical resolved
emergency.

### 1.3 Demo accounts

| Role | Username | Password | Use in the demo |
| --- | --- | --- | --- |
| Admin | `admin` | `admin123` | Users, departments, reports, audit |
| Receptionist | `reception` | `reception123` | Book for a patient, all appointments, emergency board |
| Doctor (Cardiology) | `dr.sharma` | `doctor123` | Schedule, availability, acknowledge/resolve |
| Doctor (Orthopedics) | `dr.rao` | `doctor123` | Alternate responder if needed |
| ER Staff | `er.patel` | `er123` | Emergency board, dispatch now, bed view |
| Patient | `patient.anita` | `patient123` | Self-service booking |
| Patient | `patient.rahul` | `patient123` | Second patient for a conflict demonstration |

### 1.4 Pre-flight (2 minutes)

1. Sign in as `patient.anita`; open **Book appointment**; choose **tomorrow**
   in the date picker. Confirm at least one free slot is listed. Sign out.
2. Sign in as `reception`; confirm **All appointments** and **Emergency board**
   load. Sign out.
3. Sign in as `admin`; open **Reports** and confirm the export buttons are
   enabled. Sign out.
4. Leave the app on the login screen, maximised, with the notification panel
   visible.

If the date picker defaults to today and no slots are left, always choose
tomorrow. The demo data spans seven days from first launch.

## 2. Run Sheet (8–10 minutes)

| Time | Segment | Action | What the audience should notice |
| --- | --- | --- | --- |
| 0:00–0:30 | Framing | One sentence: “HAES handles planned appointments and unplanned emergencies in one desktop app.” | Two scheduling problems, one system. |
| 0:30–2:00 | Patient booking | Sign in as `patient.anita`; open **Book appointment**; pick tomorrow; select a slot; enter “Demo consultation”; click **Book selected slot**. | Confirmation dialog, live notification, slot disappears from the free list. |
| 2:00–3:00 | Reception and conflict | Sign out; sign in as `reception`; open **Book for patient**; pick a patient and a slot already booked (or the same slot from step 1); try to book. | Clear slot-conflict message; existing booking is unchanged. |
| 3:00–4:00 | Doctor view | Sign out; sign in as `dr.sharma`; show **My schedule**; open **Availability** and add a future slot; try an overlapping slot. | Role-specific tabs; overlap rejected; slot appears for patients. |
| 4:00–5:30 | Emergency raise and dispatch | Sign out; sign in as `reception` (or stay as doctor and use the red button); click **⚠ EMERGENCY**; choose `CARDIAC`, `CRITICAL`, location `ER Gate`; submit. Open **Emergency board**; if needed click **Dispatch now**. | Case in priority queue, Critical banner, assigned doctor and bed, `RAISED`/`DISPATCHED` timeline. |
| 5:30–6:30 | Escalation | Raise a second case (`HIGH`, `RESPIRATORY`, location `Ward 2`) and deliberately do **not** acknowledge it. Continue to the next segment. | After 30 s the board shows escalation; timeline gains `ESCALATED`; audit log gains a line. |
| 6:30–7:15 | Acknowledge and resolve | Sign in as the assigned doctor (`dr.sharma` or `dr.rao`); open **Emergencies**; select the case; **Acknowledge selected**, then **Resolve selected** with a note. | Timeline completes; bed is released; patient/doctor notifications appear. |
| 7:15–8:15 | Pre-emption evidence | Do not try to stage this live unless an in-progress appointment is already seeded. Show `T-EM-08` in `docs/TESTING.md` and, if desired, run the single test. | Critical-only pre-emption; appointment `PRE_EMPTED`; slot freed; patient notified; re-book queue. |
| 8:15–9:00 | Reports, audit, notifications | As `admin`: **Reports** → export appointments and emergencies; **File → Show emergency audit log**; open a CSV. | Persistent records, RFC-style CSV, append-only audit. |
| 9:00–9:45 | Engineering evidence | Switch to the terminal; show `Tests run: 65...` and the two `[EVAL]` lines. | 50-way race: one winner; dispatch: 76/112 ms vs 1,000 ms target. |
| 9:45–10:00 | Close | One limitation and one next step. | Honest scope: simulation, single machine, NFR-3 pending. |

### If time is short (6 minutes)

Keep: patient booking → reception conflict → Critical emergency → acknowledge/
resolve → audit/CSV → test numbers. Skip the second escalation case and the
live pre-emption discussion; mention both in one sentence with the test
references.

## 3. Detailed Click Paths

### 3.1 Patient books an appointment

1. Login: `patient.anita` / `patient123`.
2. Tab: **Book appointment**.
3. Department: **All departments** (or **Cardiology**).
4. Date: click the date picker and choose **tomorrow**.
5. Select a row in the free-slot table.
6. Reason: `Demo consultation`.
7. Click **Book selected slot**.

Expected: “Appointment confirmed” dialog; notification panel shows the
confirmation; the slot is no longer in the free list; **My appointments** shows
the booking with status `Booked`.

Talking point: the UI is not the safety mechanism. The service takes a per-slot
lock and re-checks the row inside a SQLite transaction. Double-clicking the
button or two users clicking together cannot create two rows.

### 3.2 Reception sees a conflict

1. **File → Log out**; login as `reception` / `reception123`.
2. Tab: **Book for patient**.
3. Select `Anita Rao` (or the patient used above).
4. Choose the same date and the slot just booked. It should no longer appear;
   if a stale view shows it, select it and click **Book selected slot**.
5. Alternatively, open **All appointments**, note a booked slot, then return
   and try to book it for a different patient.

Expected: **Slot conflict** dialog: “That slot was just taken. Please choose
another slot.” The existing appointment is unchanged. The table refreshes.

Talking point: `T-AP-02` and `T-CC-01` prove the rejection path, including 49
losers in the 50-thread race.

### 3.3 Doctor availability and schedule

1. Log out; login as `dr.sharma` / `doctor123`.
2. Tab: **My schedule** — show today/tomorrow appointments.
3. Tab: **Availability** — choose a future date and time, click **Add slot**.
4. Try to add an overlapping slot.

Expected: the first slot is created; the overlap is rejected with a clear
message. The new slot becomes visible to patients.

Talking point: availability is future-only, doctor-only and overlap-free
(`T-AP-11`). The schedule is the doctor’s own view; a doctor cannot manage
another doctor’s appointments.

### 3.4 Raise a Critical emergency

1. Any signed-in role can use the red **⚠ EMERGENCY** button in the header.
2. Type: **Cardiac**.
3. Severity: **Critical**.
4. Location: `ER Gate` (or `Ward 2`, `Bed 7`).
5. Optional note/patient label if the dialog offers one.
6. Submit.

Expected: confirmation with the new case id; the emergency board refreshes;
Critical rows are visually distinct; the banner pulses. The background
dispatcher assigns a matching doctor and a bed within about a second. If the
board was opened before the assignment, click **Refresh** or wait for the 4 s
auto-refresh.

Talking point: the queue orders by severity, then arrival time, then id
(`T-EM-04`). Dispatch acquires a bed first, then finds a responder, so a case
never holds a doctor without a bed (`T-EM-03`, `T-EM-10`).

### 3.5 Show escalation

1. Raise a second case: **Respiratory**, **High**, `Ward 2`.
2. Do not acknowledge it. Keep the board open.
3. Wait at least 30 seconds (the default acknowledgement timeout).
4. Watch the status/timeline or open **File → Show emergency audit log**.

Expected: status becomes `Escalated`; the escalation count increments; a free
alternate responder is assigned, or the duty head warning appears; the timeline
contains `ESCALATED` with a timestamp; the audit file has a matching line.

Talking point: escalation is a scheduled scan, not a UI timer. It runs every
second, finds cases whose `dispatched_at` is older than the timeout and whose
`acknowledged_at` is null, then reassigns or warns (`T-EM-06`, `T-EM-07`).

### 3.6 Acknowledge and resolve

1. Log out; sign in as the assigned doctor. The board’s **Assigned to** column
   shows the name; `dr.sharma` is the usual Cardiology responder.
2. Tab: **Emergencies**; select the assigned case.
3. Click **Acknowledge selected**.
4. Click **Resolve selected**; enter `Stabilised; simulated outcome`.
5. Return to the ER/reception board and confirm the bed is free.

Expected: `ACKNOWLEDGED` then `RESOLVED` in the timeline; notifications to the
patient/responder; the case leaves the active board when “Include resolved” is
off; the bed can be used by the next case.

Talking point: only the assignee may acknowledge; resolution is authorised and
releases the bed. Both actions write events (`T-EM-05`).

### 3.7 Pre-emption (explain with evidence)

A live pre-emption requires a doctor to be in an appointment **right now** and
no other doctor free. That is awkward to stage in a short demo, so use the
automated evidence:

- `T-EM-08` creates an in-progress appointment, removes all free responders,
  raises a Critical case, dispatches it, and asserts:
  - the appointment becomes `PRE_EMPTED`,
  - the slot becomes `FREE`,
  - the patient receives a Critical notification,
  - the appointment appears on the re-book waitlist.
- `T-AP-12` proves the pre-empted patient can rebook, the old record becomes
  `RESCHEDULED`, and the waitlist is cleared.

If asked to show it live, explain that the production code path is the same one
exercised by the test and that staging it by hand would require manipulating
the clock/database; the test is the honest evidence.

### 3.8 Reports, audit and notifications

1. Log out; login as `admin` / `admin123`.
2. Tab: **Reports** — export appointments and emergencies to CSV.
3. **File → Import availability from CSV**; choose
   `sample-data/availability.csv` (adjust dates if they are in the past).
4. **File → Show emergency audit log**.
5. Open one exported CSV in Excel/LibreOffice or show it in a text editor.

Expected: both exports succeed and contain joined doctor/patient/slot columns;
the import reports a count; the audit log shows timestamped
`RAISED`/`DISPATCHED`/`ACKNOWLEDGED`/`ESCALATED`/`RESOLVED` lines. The
notification panel contains booking, cancellation, pre-emption and emergency
events for the signed-in user.

Talking point: SQLite is the system of record; the audit file is append-only
and the in-app notification bus is a separate, bounded event feed.

## 4. Screenshot Checklist

Capture these for the report appendix. Use the demo database, not a fixture
database.

| # | Screenshot | Why |
| --- | --- | --- |
| S-01 | Login screen with demo-account hint | Entry point and role model |
| S-02 | Patient booking tab with free slots | Main appointment workflow |
| S-03 | Booking confirmation and notification panel | Event-driven feedback |
| S-04 | My appointments with `Booked` and `Cancelled`/`Pre-empted` rows | Lifecycle states |
| S-05 | Reception all-appointments view | Staff workflow |
| S-06 | Doctor schedule and availability form | Doctor workflow |
| S-07 | Emergency dialog with type/severity/location | FR-10 and under-three-clicks flow |
| S-08 | Emergency board with Critical banner and assigned bed | Priority dispatch and visual cue |
| S-09 | Case timeline with `RAISED`/`DISPATCHED`/`ESCALATED` | FR-14 |
| S-10 | Resolve dialog and freed bed | Lifecycle completion |
| S-11 | Admin users/departments | FR-2 |
| S-12 | Reports tab and exported CSV | FR-19/FR-20 |
| S-13 | Audit log dialog | FR-18 |
| S-14 | Terminal with 65 tests and `[EVAL]` lines | NFR-1/NFR-2 evidence |
| S-15 | Architecture/class diagram slide | Design evidence |

Name files `S-01-login.png`, etc., and reference them in the report.

## 5. Slide Outline (10–12 slides)

1. **Title** — HAES, CSE 213, team names, date, “academic simulation”.
2. **Problem** — two demand streams; double booking; no priority; no audit;
   patients not rescheduled after pre-emption.
3. **Actors and requirements** — five roles; FR groups; AC-1…AC-6; NFR targets.
4. **Architecture** — layered diagram: UI → services → scheduler/DAO → SQLite;
   composition root; notification/audit side channels.
5. **Domain and database** — `User` hierarchy, `Booking` hierarchy, ER diagram,
   constraints.
6. **Concurrency design** — per-slot lock + transaction re-check + write lock;
   the 50-thread race result.
7. **Emergency design** — priority queue, dispatcher, bed pool, escalation
   timer, Critical pre-emption sequence.
8. **Demo** — live application (or screenshots if the display fails).
9. **Testing** — 65 tests, 12 classes, AC matrix, defect log highlights.
10. **Evaluation** — measured metrics table vs targets and baseline caveats.
11. **Limitations and ethics** — single machine, simulation, NFR-3 pending,
    invented data, consent for user studies.
12. **Conclusion and next steps** — what was built, what was proven, what would
    be measured next.

Keep text sparse; put the class/ER diagrams and the metrics table on slides,
and leave the detailed test inventory for the appendix.

## 6. Q&A Talking Points

| Likely question | Short answer |
| --- | --- |
| Why SQLite instead of a server database? | The brief asks for a desktop simulation with JDBC and full CRUD. SQLite gives a real transactional database with zero setup. The trade-off is single-machine concurrency and no network access. |
| Why a per-slot lock if SQLite already serialises writes? | The lock makes the check-then-insert sequence explicit at the domain level and avoids every booking contending on one global write lock. The transaction re-check is still the final authority, so correctness does not depend on the lock alone. |
| What happens with two app instances? | SQLite locking and the busy timeout protect the file at a basic level, but HAES is designed for one desktop instance. Multi-process coordination is a stated limitation. |
| How does escalation choose the next responder? | It excludes the current assignee and anyone already assigned to an active case, prefers a free matching responder, and otherwise warns the duty head. Every attempt is event-logged. |
| When can a case pre-empt? | Only `CRITICAL`, and only when no free doctor is available. It prefers a specialty match, then any doctor. The appointment becomes `PRE_EMPTED`, the slot is freed and the patient is notified. |
| What if no bed is free? | The case stays `WAITING` and returns to the priority queue; the board shows the wait. A later release lets dispatch retry (`T-EM-10`). |
| What if no responder is free? | Non-critical cases wait; Critical may pre-empt. If neither works, the case remains queued and escalation warns the duty head. |
| How are UI updates kept thread-safe? | The notification service is thread-safe; JavaFX updates are marshalled with `Platform.runLater`; views refresh from services, not from background SQL. |
| Is the password storage secure? | PBKDF2-HMAC-SHA256, random 16-byte salt, 65,536 iterations. It is still demo-grade identity management, not production IAM. |
| What is the biggest limitation? | The evaluation is a small simulation on one machine, and NFR-3 has no human user study yet. The report must say that. |
| What would you do next? | Run the consented usability test, add a naive-list baseline harness, measure the asynchronous dispatcher path, and add UI automation. |
| Why no FXML? | Programmatic JavaFX keeps the project self-contained and makes role-specific composition explicit. The trade-off is more verbose view code. |
| How do you know the database is consistent? | Foreign keys on every connection, prepared statements, transactions for multi-row changes, unique/check constraints, and rollback tests (`T-DB-02`–`T-DB-05`). |

## 7. Failure Recovery During the Demo

| Problem | Recovery |
| --- | --- |
| App will not start / “Database problem” | Close other instances; delete `haes.db*`; relaunch. The demo data reseeds. |
| No free slots on today’s date | Choose tomorrow or another doctor/department. |
| Emergency not assigned yet | Wait for the 4 s board refresh, click **Refresh**, or press **Dispatch now** on the ER board. |
| Escalation not visible after 30 s | Keep the board open and click **Refresh**; check the audit log. The scan runs every second. |
| Cannot acknowledge | The signed-in user is not the assignee. Check **Assigned to**, log in as that doctor, or use an admin/ER account if the flow allows it. |
| Pre-emption cannot be staged | Show `T-EM-08` and `T-AP-12`; explain the test setup. Do not improvise by editing the live database. |
| CSV export dialog path issue | Save into the project folder or Desktop; confirm the success dialog. |
| JavaFX cannot open a display | Fall back to the test terminal, the screenshots and the design/evaluation docs. State the display limitation plainly. |
| Projector cuts off the window | Maximise; the layout is designed for 1380×840 and has a 1120×700 minimum. Collapse the notification panel if necessary. |

## 8. Closing Script (30 seconds)

> “HAES is a simulation of two scheduling problems in one hospital desktop
> application. The appointment side is protected by per-slot locks and database
> transactions; the emergency side uses a priority queue, a dispatcher, a bed
> pool and a 30-second escalation timer, with Critical-only pre-emption. The
> test suite has 65 passing tests. The 50-thread race produces exactly one
> booking, and mixed-severity dispatch averages 76 ms with a 112 ms maximum
> against a one-second target. The honest limitations are that this is a
> single-machine SQLite simulation and the usability target still needs a
> consented user test.”

## 9. After the Demo

- Close the app so the SQLite connection and audit writer are released.
- Keep the demo database and CSV files if the examiner wants to inspect them.
- For submission, remove generated runtime files from the project root:

```bat
del haes.db haes.db-shm haes.db-wal emergency_audit.log
```

- Archive the test output (`target/surefire-reports/`) and the screenshots with
  the report appendix.
