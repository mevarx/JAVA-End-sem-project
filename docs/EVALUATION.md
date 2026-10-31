# HAES Evaluation

This document reports the measured results for the two non-functional targets
that can be evaluated automatically, explains how the measurements were taken,
and compares HAES with the manual first-come-first-served baseline described
in the PRD. It also states what was **not** measured so the final report does
not overclaim.

> HAES is an academic simulation using invented data. The numbers below come
> from a local SQLite file on one laptop; they are engineering evidence, not a
> clinical performance claim.

## 1. Evaluation Questions

| ID | Question | Related requirement | Evidence |
| --- | --- | --- | --- |
| RQ1 | Does concurrent booking produce exactly one appointment for one slot? | NFR-1, AC-1 | `ConcurrentBookingTest`, `EvaluationTest.bookingRaceMetrics` |
| RQ2 | Is emergency dispatch fast enough under a mixed-severity load? | NFR-2, AC-2 | `EvaluationTest.dispatchLatencyMetrics`, `EmergencyServiceTest` |
| RQ3 | Can a new patient complete a booking in under 60 seconds? | NFR-3 | Manual protocol; **not measured in this build** |
| RQ4 | Do database failures produce controlled errors and rollbacks? | NFR-4, AC-4 | `DatabaseFailureTest` |
| RQ5 | Are escalation and pre-emption behaviourally correct and logged? | AC-3, AC-6, FR-12–FR-14 | `EmergencyServiceTest` |

## 2. Environment

| Item | Value |
| --- | --- |
| Date of recorded run | 31 October 2026 |
| Operating system | Windows (win32), local NTFS working directory |
| JDK | Microsoft OpenJDK 21.0.10+7-LTS |
| Compilation target | Java 17 (`maven.compiler.release=17`) |
| JavaFX | 21.0.5 |
| Database | SQLite via `org.xerial:sqlite-jdbc:3.45.3.0`, WAL mode, local file |
| Build tool | Apache Maven 3.9.9 (also runnable through the included wrapper) |
| Test framework | JUnit Jupiter 5.10.2, Surefire 3.2.5 |
| Machine | Development laptop; CPU/RAM model not captured in the test output |
| Load | Normal desktop session; no CPU pinning, no isolated benchmark host |

Because the machine and JVM are shared with the IDE and desktop, the timings
are best read as “same-order-of-magnitude evidence” rather than laboratory
benchmarks. The pass/fail assertions are deliberately loose enough to remain
stable while still enforcing the PRD targets.

## 3. Recorded Results

Command:

```bat
mvnw.cmd test
```

Result: **65 tests run, 0 failures, 0 errors, 0 skipped**; build time 13.3 s.

```text
[EVAL] booking race: attempts=50 successes=1 doubleBookings=0 elapsedMs=240
[EVAL] emergency dispatch: cases=8 avgLatencyMs=76 maxLatencyMs=112
```

| Indicator | Target | Measured result | Verdict |
| --- | --- | --- | --- |
| Double bookings in a 50-way race | 0 | 0 (1 success, exactly 1 persisted appointment row) | **Met** |
| Booking race wall-clock time | Informational | 240 ms for 50 contending callers | Recorded |
| Mean emergency dispatch latency | Informational; target is on the maximum | 76 ms | Recorded |
| Maximum emergency dispatch latency | Under 1,000 ms | 112 ms | **Met** (888 ms headroom) |
| Unacknowledged, un-escalated cases in the tested lifecycle | 0 | 0 in the deterministic escalation tests | **Met at unit/integration level** |
| Database failure handling | Controlled error, rollback, no crash | 7/7 failure-mode tests pass | **Met at service/startup level** |
| New-patient booking time | Under 60 s | Not measured | **Pending user test** |
| User satisfaction | 4/5 target | Not measured | **Pending user test** |

The evaluation numbers vary slightly between runs because they include thread
scheduling and local I/O. Observed ranges across repeated final runs were
206–240 ms for the booking race and 76–83 ms average / 112–123 ms maximum for
dispatch. The assertions are what make the build meaningful:

- `assertEquals(1, successes)`
- `assertEquals(1, persisted.size())`
- `assertTrue(maxMillis < 1_000)`

## 4. Method: 50-Thread Booking Race

Implementation: `src/test/java/com/hospital/haes/EvaluationTest.java`
(`bookingRaceMetrics`) and `src/test/java/com/hospital/haes/service/ConcurrentBookingTest.java`.

Procedure:

1. Create one 30-minute future slot for one doctor.
2. Create 50 distinct patient accounts so the per-patient appointment limit
   cannot be the reason a caller loses.
3. Create a fixed thread pool of 50 threads and a `CountDownLatch` barrier.
4. Each task waits for the barrier, calls
   `AppointmentService.book(patientId, slotId, "race")`, and returns `true` on
   success or `false` on `SlotConflictException`.
5. Release the barrier; wait for all 50 futures with a 30-second timeout.
6. Count the persisted appointment rows for that slot and compare them with the
   success count.
7. Report successes, double bookings and elapsed wall-clock milliseconds.

Measured result:

| Quantity | Value |
| --- | ---: |
| Attempts | 50 |
| Successful bookings | 1 |
| Rejected bookings | 49 |
| Persisted appointments for the slot | 1 |
| Double bookings | 0 |
| Elapsed time | 240 ms |

Interpretation: the elapsed number is the time to release 50 callers, let them
contend, and collect all futures. It is **not** the latency of one booking; a
single uncontended booking is much faster. The important result is the
invariant: one success and one row.

Why this is credible:

- The per-slot `ReentrantLock` makes the check-then-insert sequence a critical
  section for that slot.
- The database transaction re-reads the slot and requires `FREE` before the
  update, so a stale pre-check cannot produce a second insert.
- `DatabaseManager` serialises writes with a fair lock, and SQLite commits the
  slot update and appointment insert together.
- The test deliberately uses 50 **different** patients, so the active-booking
  limit cannot mask a race.

## 5. Method: Emergency Dispatch Latency

Implementation: `EvaluationTest.dispatchLatencyMetrics`.

Procedure:

1. Build a fixture with 8 beds and a 30-second acknowledgement timeout.
2. Deactivate the ER staff account so dispatch must use doctors.
3. Use the fixture doctor plus seven additional on-call Cardiology doctors.
4. Raise eight Cardiac cases with severities
   `CRITICAL, HIGH, MEDIUM, CRITICAL, HIGH, MEDIUM, CRITICAL, HIGH`.
5. Call `EmergencyService.dispatchPendingNow()` and count assignments.
6. For each case, compute `Duration.between(raisedAt, dispatchedAt)`.
7. Report the average and maximum, and assert the maximum is below 1,000 ms.

Measured result:

| Quantity | Value |
| --- | ---: |
| Cases raised | 8 |
| Cases dispatched | 8 |
| Doctors available | 8 |
| Average raise-to-dispatch latency | 76 ms |
| Maximum raise-to-dispatch latency | 112 ms |
| Target | < 1,000 ms |
| Headroom at the maximum | 888 ms |

Interpretation:

- The timestamps come from the persisted `raised_at` and `dispatched_at`
  columns, so the measurement covers the service work: validation, queue
  insertion, transaction, responder lookup, bed acquisition, status update and
  event write.
- The test calls the synchronous dispatch path to remove background polling
  from the measurement and to make the test deterministic. The production
  dispatcher polls with a 500 ms timeout and retries a failed case after a
  short pause. Even adding the worst-case polling interval to the measured
  processing time stays below the 1-second target for this workload.
- The eight cases are processed in priority order (Critical before High before
  Medium), which is separately asserted by `T-EM-04`.

This is a simulation of assignment latency, not a measure of real ambulance or
clinical response time. The PRD’s NFR-2 is explicitly about “raise to
assignment in the simulation”.

## 6. Baseline Comparison

The PRD defines the baseline as a **manual first-come-first-served register,
simulated as a plain list without priority or locking**. HAES did not ship a
second baseline application. The table below therefore separates:

- **measured HAES results** (from the test harness), and
- **baseline properties implied by its definition** (not invented timings).

| Indicator | Manual FCFS baseline (by definition) | HAES (measured / implemented) | Basis of comparison |
| --- | --- | --- | --- |
| Double bookings under contention | No atomic check; two clerks/threads can both accept the same slot. | 0 double bookings in a 50-way race; 1 persisted row. | Design analysis of the baseline + measured HAES result. |
| Priority order | Arrival order only; a Critical case can wait behind a Medium case. | Severity first, then arrival time; asserted by `T-EM-04`. | Behavioural test, not a timing comparison. |
| Dispatch time | Manual phone/paper coordination; minutes in a real ward (assumed, not measured here). | 76 ms average, 112 ms maximum in the simulation. | Different processes; do **not** claim a direct speed-up without measuring the manual baseline. |
| Escalation | No automatic timer; depends on a person noticing. | 30 s configurable timeout; overdue cases reassigned or duty head warned; event + audit line. | `T-EM-06`, `T-EM-07`. |
| Pre-emption | Ad hoc; patient may not be told. | Critical-only pre-emption; appointment `PRE_EMPTED`, slot freed, patient notified, waitlist updated. | `T-EM-08`, `T-AP-12`. |
| Audit trail | Paper/verbal, inconsistent. | Append-only `emergency_audit.log` plus timestamped `emergency_events` rows. | `T-EM-01`, `T-EM-05`, `T-EM-06`. |
| Bed allocation | Manual board; possible double allocation. | Semaphore + unique bed queue; concurrent uniqueness test. | `T-BP-01`–`T-BP-04`. |
| Booking completion time | Manual register; variable. | Not measured. | Pending NFR-3 user test. |
| User satisfaction | Not applicable to a paper baseline. | Not measured. | Pending questionnaire. |

The honest conclusion is **not** “HAES is 1,000× faster than a hospital”. It
is: HAES provides guarantees the manual baseline does not have (atomic slot
allocation, priority ordering, bounded escalation, auditability) and, in the
simulated workload, meets the 1-second dispatch target with a wide margin.

If a quantitative baseline is required for the final report, the cleanest
extension is a small “naive list” harness that performs a non-atomic
check-then-add for the same 50 callers and reports how many accepted the same
slot. That number should be collected, not assumed. It is deliberately not
fabricated here.

## 7. Reliability and Lifecycle Evidence

The evaluation is not only about speed. The following tests support the
qualitative claims in the comparison:

| Claim | Evidence |
| --- | --- |
| A failed transaction leaves no partial data | `T-DB-02` |
| Foreign keys and unique constraints are active | `T-DB-04`, `T-DB-05` |
| A bad database path produces a typed error | `T-DB-06`, `T-DB-07` |
| A case cannot be acknowledged by the wrong user | `T-EM-05` |
| Resolution releases the bed | `T-EM-05` |
| Escalation is timestamped and audited | `T-EM-06`, `T-EM-07` |
| Critical pre-emption notifies the patient and creates a rebooking path | `T-EM-08`, `T-AP-12` |
| Bed exhaustion leaves the case waiting rather than double-assigning | `T-EM-10`, `T-BP-04` |
| A pre-empted appointment can be rebooked without leaving a stale waitlist entry | `T-AP-12` |

## 8. Threats to Validity

### Internal validity

- **Timing noise.** The machine also runs the IDE and desktop. JVM warm-up,
  class loading, GC and disk cache affect the milliseconds. The tests assert
  generous thresholds and the report gives ranges, not single-point precision.
- **Synchronous dispatch path.** `dispatchPendingNow()` removes scheduler
  polling from the latency measurement. It measures the dispatch work itself;
  the production thread adds up to a 500 ms poll interval. The combined worst
  case is still below 1 s for this workload, but the exact asynchronous latency
  is not separately benchmarked.
- **Clock resolution.** Timestamps are stored as ISO-8601 text from
  `LocalDateTime`; very short operations can round to the same millisecond.
  This affects the average slightly, not the pass/fail invariant.
- **Test fixture wiring.** The fixture constructs the same classes as
  `AppContext`, but it is not the JavaFX process. A UI-only regression would
  not be caught by these tests; the manual checklist covers that gap.

### External validity

- One desktop, one SQLite file, one JVM. No network, multi-user server, or
  multi-process contention.
- Eight emergency cases and eight doctors are enough to exercise ordering and
  bed assignment, not to estimate hospital throughput.
- The sample data is invented and small; there is no real arrival distribution.
- Results should not be generalised to clinical response times or production
  hospital workloads.

### Construct validity

- “Dispatch latency” means raise-to-database-assignment in the simulation, not
  time to clinician bedside.
- “Double booking” means more than one persisted appointment row for the same
  slot after the race; the test checks the database, not only UI messages.
- “Usability” is not inferred from the code or from the developers’ own use.
  It requires the consented participant protocol described in
  [TESTING.md](TESTING.md#10-user-test-protocol-for-nfr-3-pending).

### Conclusion validity

- The sample sizes are small and the tests are deterministic by design. A
  passing build is evidence that the implemented invariants hold for the tested
  scenarios, not proof for all possible schedules.
- The baseline is not a second running system, so any speed comparison beyond
  the measured simulation would be speculative.

## 9. What Would Strengthen the Evaluation

1. Run the NFR-3 user test with 3–5 consented participants and report median
   and range.
2. Add a naive-list baseline harness for the 50-way race and record how many
   callers accept the same slot without locking.
3. Measure the asynchronous dispatcher path (not only `dispatchPendingNow`) with
   a timestamp at enqueue and at assignment, over several repetitions.
4. Repeat the dispatch test with 50–100 cases and more doctors to find the
   saturation point.
5. Run the booking race on a second machine/OS to check that the invariant and
   timing order of magnitude hold.
6. Add a UI timing measurement for the booking form (time from login to
   confirmation), separate from the human user test.

## 10. Reproducing and Archiving the Evidence

```bat
mvnw.cmd test
```

Capture:

- console output containing the two `[EVAL]` lines,
- `target/surefire-reports/*.txt` and `*.xml`,
- a screenshot of the build result,
- the `git`/submission version identifier (the workspace is not a git
  repository in this build, so record the submission date and archive name).

Store the raw output with the report appendix. If the numbers are re-run on a
different machine, label them as a separate run rather than mixing them with
the values in Section 3.

## 11. Summary

| Requirement | Status |
| --- | --- |
| NFR-1: zero double bookings in a 50-way race | **Met and measured** |
| NFR-2: dispatch under 1 second | **Met and measured** (76 ms average, 112 ms maximum) |
| NFR-3: booking under 60 seconds | **Pending human user test** |
| NFR-4: controlled database failure | **Met at service/startup level; locked-file dialog manual** |
| NFR-5: integrity (foreign keys, prepared statements) | **Met and tested** |
| NFR-6: layered maintainability | **Met by structure and review** |
| NFR-7: privacy and ethics | **Met for invented data; consent required for any user study** |

The project has strong evidence for the two engineering claims that are
central to the course: conflict-free concurrent booking and priority emergency
dispatch. It does not claim a measured usability improvement, and the final
report should say so plainly.
