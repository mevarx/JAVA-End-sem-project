# HAES Final Report Outline

This is a suggested structure for the CSE 213 final report. It maps each
section to the evidence already in the repository so the report can be written
without inventing results. Adjust the length and headings to the course’s
submission rules.

> The report must describe HAES as an academic simulation built on invented
> data. Do not present it as a clinical system and do not include real patient
> information.

## 1. Suggested Front Matter

1. Title page: project title, course code, team members, submission date,
   institution.
2. Declaration of originality and team-contribution statement.
3. Abstract (200–300 words): problem, approach, key mechanisms, 65 tests,
   measured results, limitations.
4. Acknowledgements (optional).
5. Table of contents, list of figures, list of tables, list of abbreviations.
6. Ethics statement (short version; full statement in an appendix).

### Abstract skeleton

> HAES is a JavaFX and SQLite desktop simulation of hospital outpatient
> scheduling and emergency dispatch. It combines per-slot locking and SQLite
> transactions for conflict-free booking with a severity-ordered priority queue,
> a background dispatcher, a shared ER bed pool, acknowledgement escalation and
> Critical-only pre-emption. The implementation is layered into model, service,
> scheduler, DAO, utility and UI packages and is exercised by 65 JUnit tests,
> including a 50-thread booking race and a mixed-severity dispatch benchmark.
> The race produced exactly one appointment from 50 simultaneous attempts, and
> dispatch averaged 76 ms with a 112 ms maximum against a one-second target.
> The report also states the limits of the evaluation: it is a single-machine
> simulation, and the usability target still requires a consented user study.

## 2. Chapter Structure

### 1. Introduction

- Problem context: hospitals handle planned outpatient demand and unplanned
  emergencies at the same time.
- Motivation: manual registers can double-book, emergencies have no consistent
  priority, and pre-empted patients may not be told to rebook.
- Goals: conflict-free booking, priority dispatch, escalation, auditability,
  role-based UI, measurable evidence.
- Scope and non-goals: desktop simulation; no real SMS/email, no diagnosis,
  no billing, no hospital-system integration, no real patient data.
- Contributions:
  1. A layered Java implementation of two coupled scheduling problems.
  2. A concurrency design combining per-slot locks, serialized write
     transactions and database constraints.
  3. A priority dispatch/escalation/pre-emption lifecycle with an audit trail.
  4. A reproducible test and evaluation harness.
- Report roadmap.

**Evidence:** `README.md`, PRD Sections 1–3, `docs/DESIGN.md`.

### 2. Requirements and Problem Validation

- Actors: Patient, Doctor, Receptionist, ER Staff, Admin.
- Functional requirements grouped as FR-1…FR-20.
- Non-functional requirements NFR-1…NFR-7.
- Acceptance criteria AC-1…AC-6.
- Assumptions and constraints (single machine, local SQLite, invented data,
  simplified triage).
- Validation: report interviews with at least three consented participants if
  they were conducted. If not, say so and describe the planned protocol. Do not
  invent quotes or participant details.

**Evidence:** PRD Sections 4–7 and 13; `docs/TESTING.md` acceptance matrix.
**Suggested table:** actor → needs → requirement IDs.

### 3. Background and Related Work

Keep this short and cite properly. Cover only what the design uses:

- Priority scheduling and priority queues.
- Optimistic vs pessimistic concurrency control; database transactions.
- Escalation/timeout patterns in workflow systems.
- JavaFX desktop architecture and JDBC/SQLite.
- Password hashing with PBKDF2.

Avoid claiming a novel algorithm. HAES combines known techniques in a course
project; the contribution is the integration and the evidence.

**Possible references:** JavaFX documentation, SQLite documentation, JDBC
tutorial, JUnit user guide, RFC 8018 (PBKDF2), a standard operating-systems or
Java-concurrency text. Verify every URL and edition before submission.

### 4. System Design

- Architectural style and layer responsibilities.
- Package map and dependency direction.
- Domain model: `User` hierarchy, `Booking` hierarchy, interfaces, enums.
- Database schema and ER diagram; constraints and integrity rules.
- Appointment booking critical section (sequence diagram).
- Emergency lifecycle (state/sequence diagram).
- Threading model: JavaFX thread, dispatcher, escalation timer, booking
  callers, serialized SQLite writes.
- UI composition: role-specific tabs; programmatic JavaFX; notification panel.
- Key design decisions and trade-offs.

**Evidence:** `docs/DESIGN.md` Sections 1–9; `src/main/resources/db/schema.sql`.
**Figures:** layered architecture, UML class diagram, ER diagram, booking
sequence, emergency sequence, thread/event flow.

### 5. Implementation

- Technology stack and build setup (Java 17 target, JavaFX 21, SQLite JDBC,
  Maven Wrapper, JUnit 5).
- Generic `Repository<T, ID>` and DAO mapping.
- `DatabaseManager`: connections, foreign keys, WAL, busy timeout, serialized
  transactions, schema initialization.
- Booking: validation, per-slot lock, transaction re-check, notifications.
- Emergency service: raise, queue, dispatch, bed acquisition, responder
  selection, acknowledge, resolve.
- Escalation timer and pre-emption.
- CSV import/export, file audit log, `Result<T>`.
- Validation and password hashing.
- Role-based UI and event delivery to the JavaFX thread.
- A short code walkthrough with 2–4 carefully chosen snippets (not pages of
  code). Explain why the snippet matters.

**Evidence:** source packages; `docs/DESIGN.md`; `README.md`.

### 6. Testing

- Strategy: unit, integration with real SQLite, concurrency, failure,
  non-functional, manual UI.
- Test isolation via `TestFixture` and `@TempDir`.
- Inventory summary: 12 test classes, 65 tests.
- Acceptance-criteria matrix AC-1…AC-6.
- Concurrency test design and result.
- Failure-injection coverage.
- Defect log: symptom → root cause → fix → regression test.
- Manual UI checklist and results.
- What is not covered: UI automation, locked-file automation, human usability.

**Evidence:** `docs/TESTING.md`; `target/surefire-reports/`.
**Tables:** class/test counts, AC matrix, defect log, manual checklist summary.

### 7. Evaluation

- Evaluation questions and indicators.
- Environment and methodology.
- Booking-race method and result.
- Dispatch-latency method and result.
- Baseline definition and a careful comparison (separate measured results from
  baseline assumptions).
- Threats to validity.
- Reliability and lifecycle evidence.
- What would strengthen the evaluation.

**Evidence:** `docs/EVALUATION.md`; console `[EVAL]` lines; Surefire reports.
**Tables:** metrics vs targets, baseline comparison, threats to validity.

Do not write “HAES is X times faster than manual scheduling” unless the manual
baseline was actually measured. The current evidence supports guarantees and
simulated latency, not a clinical speed-up.

### 8. Discussion and Limitations

- What the results mean: the concurrency invariant held; dispatch met the
  simulation target; escalation/pre-emption are behaviourally tested.
- Trade-offs: coarse write lock vs throughput; per-slot lock map growth;
  bed-before-responder ordering; in-memory queue; Critical-only pre-emption;
  programmatic UI.
- Limitations:
  - single-machine SQLite, no multi-device sync;
  - simulated notifications and triage;
  - small synthetic workload;
  - no UI automation;
  - NFR-3 usability not measured without a consented study;
  - locked-database dialog checked manually.
- Ethical scope: invented data, no diagnosis, no real patient identifiers.

**Evidence:** `README.md` Known Limitations; `docs/DESIGN.md` Section 11;
`docs/EVALUATION.md` Section 8.

### 9. Conclusion and Future Work

- Restate the problem and what was delivered.
- Summarise measured outcomes (one winner in the 50-way race; 76/112 ms
  dispatch; 65 passing tests).
- State the limits plainly.
- Future work:
  1. Consented usability study for NFR-3.
  2. Naive-list baseline harness for a measured comparison.
  3. Asynchronous dispatcher latency benchmark at larger scale.
  4. Multi-process/server database exploration.
  5. UI automation (TestFX) and accessibility review.
  6. Richer triage policy only with clinical input and ethics approval.

### 10. References

Use a consistent style required by the course (IEEE or APA). Include at least:

- JavaFX documentation.
- SQLite documentation and the JDBC driver.
- JUnit 5 user guide.
- Apache Maven documentation.
- RFC 8018 for PBKDF2.
- One or more texts on concurrency/operating systems.
- Any papers used for priority scheduling or escalation patterns.
- The project PRD/brief, if the course allows internal references.

Placeholder format:

```text
[1] Oracle, “JavaFX Documentation,” https://openjfx.io/, accessed Oct. 2026.
[2] SQLite Consortium, “SQLite Documentation,” https://sqlite.org/docs.html, accessed Oct. 2026.
[3] JUnit Team, “JUnit 5 User Guide,” https://junit.org/junit5/docs/current/user-guide/, accessed Oct. 2026.
[4] B. Kaliski, “PKCS #5: Password-Based Cryptography Specification Version 2.0,” RFC 2898, 2000. (Or RFC 8018, 2017.)
```

Verify the exact titles, versions and access dates before submission. Do not
cite a source that was not actually consulted.

## 3. Figures and Tables to Include

| Figure | Source / how to produce |
| --- | --- |
| F-1 Layered architecture | `docs/DESIGN.md` Mermaid diagram |
| F-2 UML class diagram | `docs/DESIGN.md` Mermaid diagram |
| F-3 ER diagram | `docs/DESIGN.md` Mermaid diagram |
| F-4 Booking sequence | `docs/DESIGN.md` Mermaid sequence |
| F-5 Emergency dispatch sequence | `docs/DESIGN.md` Mermaid sequence |
| F-6 Emergency state/event flow | `docs/DESIGN.md` flowchart |
| F-7 Login screen | screenshot S-01 |
| F-8 Booking screen | screenshot S-02 |
| F-9 Emergency board | screenshot S-08 |
| F-10 Case timeline | screenshot S-09 |
| F-11 Test/evaluation output | screenshot S-14 |

| Table | Source |
| --- | --- |
| T-1 Actors and needs | PRD Section 4 |
| T-2 Functional requirements | PRD Section 5 |
| T-3 Non-functional requirements | PRD Section 6 |
| T-4 Acceptance criteria and status | `docs/TESTING.md` Section 4 |
| T-5 Test inventory summary | `docs/TESTING.md` Section 3 |
| T-6 Defect log | `docs/TESTING.md` Section 7 |
| T-7 Evaluation results | `docs/EVALUATION.md` Section 3 |
| T-8 Baseline comparison | `docs/EVALUATION.md` Section 6 |
| T-9 Threats to validity | `docs/EVALUATION.md` Section 8 |
| T-10 Rubric coverage | Section 4 below |

## 4. Rubric Coverage Map

| Criterion (PRD Section 14) | Where the report covers it | Repository evidence |
| --- | --- | --- |
| Problem relevance and requirements (10) | Chapters 1–2 | PRD, README, requirements tables |
| OOP architecture (15) | Chapter 4 | `model` hierarchy, interfaces, package map |
| Exceptions and reliability (10) | Chapters 4–6 | `exception` package, validation, rollback tests |
| Threads, I/O and events (15) | Chapters 4–7 | dispatcher, timer, locks, audit, CSV, notification bus |
| JDBC and collections (15) | Chapters 4–6 | schema, DAOs, transactions, priority queue, lists/maps |
| Generics and JavaFX (15) | Chapters 4–6 | `Repository<T,ID>`, `PriorityScheduler<T>`, `Result<T>`, role views |
| Testing and measured results (10) | Chapters 6–7 | 65 tests, AC matrix, evaluation metrics |
| Team demonstration and report (10) | Demo + report | `docs/DEMO.md`, contribution statement, ethics |

## 5. Claims-to-Evidence Checklist

Before submitting, make sure every strong claim has a pointer:

| Claim | Evidence to cite |
| --- | --- |
| “Booking is conflict-free under concurrency.” | `T-CC-01`, `T-EV-01`, per-slot lock + transaction design |
| “Exactly one appointment survives 50 simultaneous attempts.” | Measured 1 success / 1 row; console output |
| “Critical cases are dispatched before Medium cases.” | `T-EM-04` |
| “Unacknowledged cases escalate with a timestamp.” | `T-EM-06`, `T-EM-07`, audit/event assertions |
| “Critical cases can pre-empt routine appointments.” | `T-EM-08`, `T-AP-12` |
| “Beds are never double-assigned.” | `T-BP-04`, `T-EM-10` |
| “Dispatch is under one second in the simulation.” | `T-EV-02`: 76 ms avg / 112 ms max; assertion `< 1,000` |
| “Every query uses prepared statements.” | DAO source review; `T-DB-04`/`T-DB-05` for constraints |
| “The UI is role-based.” | `MainWindow` role switch; manual checklist U-03 |
| “The system is usable in under 60 seconds.” | **No evidence yet** — do not claim; run the NFR-3 protocol |
| “The system is production-ready.” | **Do not claim** — it is a course simulation |

## 6. Ethics Statement Template

Adapt the wording to the course’s policy, but keep these facts:

> This project is an academic simulation. All accounts, appointments,
> emergencies, locations and patient labels are invented. The application does
> not store real patient identifiers, diagnoses, billing data or clinical
> decision support. No real hospital system was accessed. Any user interviews
> or usability tests will be conducted only after obtaining written or recorded
> consent, will be anonymised as P1, P2, P3, and will not involve real medical
> records. Participants may withdraw at any time. Consent forms and raw notes
> will be stored separately from the report and destroyed after the course
> assessment. The project makes no clinical claims and must not be used for
> patient care.

If interviews were conducted, add:

- number of participants and their roles (anonymised);
- date/format of consent;
- how notes were stored and anonymised;
- where the consent forms are kept (not in the public repository).

If they were not conducted, state that the validation requirement is pending
and describe the planned protocol. Do not fabricate participants.

## 7. Appendices

Suggested appendices:

- A. Full test inventory (65 cases) — can reuse `docs/TESTING.md` Section 3.
- B. Acceptance-criteria matrix and manual UI checklist.
- C. Defect log.
- D. Evaluation raw output and Surefire summary.
- E. Screenshots (S-01…S-15).
- F. Consent form template and anonymised interview notes (if applicable).
- G. User-test protocol and results (if applicable).
- H. Source-code map and build instructions.
- I. Demo script (`docs/DEMO.md`).
- J. Team contribution matrix.

### Team contribution matrix template

| Member | Requirements/design | Database/JDBC | Concurrency/tests | UI/docs | Demo |
| --- | --- | --- | --- | --- | --- |
| Member 1 |  |  |  |  |  |
| Member 2 |  |  |  |  |  |
| Member 3 |  |  |  |  |  |
| Member 4 |  |  |  |  |  |

Every member should be able to explain the architecture, database, concurrency,
UI and results, not only their own module (PRD Section 10).

## 8. Writing Plan and Word Budget

Adjust to the course limit. A practical split for a 10,000-word report:

| Part | Words | Notes |
| --- | ---: | --- |
| Front matter + abstract | 500 | Abstract last |
| Introduction | 900 | Problem, goals, contributions |
| Requirements | 1,200 | Tables, not prose repetition |
| Background/related work | 900 | Keep focused |
| Design | 2,000 | Diagrams carry detail |
| Implementation | 1,800 | Few code snippets, explain decisions |
| Testing | 1,300 | Inventory summary + AC matrix |
| Evaluation | 1,200 | Numbers + threats |
| Discussion/limitations | 700 | Honest scope |
| Conclusion/future work | 500 | No new claims |
| References/appendices | — | Outside word count if allowed |

Write the evaluation and testing chapters from the actual outputs, not from
memory. Re-run `mvnw.cmd test` on the submission machine and label the run.

## 9. Submission Checklist

- [ ] Source code builds from a clean checkout with `mvnw.cmd test`.
- [ ] All 65 tests pass; output archived.
- [ ] `README.md` quick start, demo accounts and CSV format are current.
- [ ] `docs/DESIGN.md` diagrams match the code.
- [ ] `docs/TESTING.md` inventory and results match the final run.
- [ ] `docs/EVALUATION.md` numbers match the archived output.
- [ ] `docs/DEMO.md` accounts and click paths match the UI.
- [ ] UML class, ER, thread and event-flow diagrams exported as images.
- [ ] Screenshots captured at a readable resolution.
- [ ] Test case table and defect log included.
- [ ] Evaluation results vs baseline included, with baseline caveats.
- [ ] User feedback summary included **only if real, consented data exists**.
- [ ] Ethics statement and consent forms handled correctly.
- [ ] References verified and consistently styled.
- [ ] Plagiarism check completed.
- [ ] Runtime files (`haes.db*`, `emergency_audit.log`, `target/`) excluded
      from the source archive where appropriate.
- [ ] Demo rehearsed end-to-end on the presentation machine.
- [ ] Contribution matrix signed/agreed by all members.

## 10. Research Screening Note (PRD Stage 8)

The likely outcome is a **project report and chapter evidence**. A short
conference paper could be considered only if the evaluation is strengthened
with a measured baseline, a larger workload and a consented user study. A
patent is unlikely because the project combines known techniques rather than
introducing a new mechanism.

If pursuing a paper:

- add the naive-list baseline and user-test results;
- run dispatch at larger scale and report saturation;
- add related-work citations for priority scheduling and escalation;
- verify the venue through established indexes and avoid predatory venues;
- obtain ethics approval before collecting any participant data.
