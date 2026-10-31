-- HAES schema (SQLite). Executed by DatabaseManager on startup.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ER_STAFF', 'ADMIN')),
    full_name TEXT NOT NULL,
    phone TEXT,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    specialization TEXT,
    on_call INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'FREE' CHECK (status IN ('FREE', 'BOOKED')),
    UNIQUE (doctor_id, start_time)
);

CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER NOT NULL REFERENCES slots(id) ON DELETE RESTRICT,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT,
    status TEXT NOT NULL CHECK (status IN ('BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED', 'PRE_EMPTED')),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emergencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    patient_label TEXT,
    type TEXT NOT NULL CHECK (type IN ('CARDIAC', 'TRAUMA', 'RESPIRATORY', 'STROKE', 'OTHER')),
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM')),
    location TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('WAITING', 'ASSIGNED', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED')),
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    bed_no INTEGER,
    raised_at TEXT NOT NULL,
    dispatched_at TEXT,
    acknowledged_at TEXT,
    resolved_at TEXT,
    escalation_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS emergency_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emergency_id INTEGER NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_time TEXT NOT NULL,
    note TEXT
);

CREATE INDEX IF NOT EXISTS idx_slots_doctor_time ON slots (doctor_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments (patient_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments (slot_id);
CREATE INDEX IF NOT EXISTS idx_emergencies_status ON emergencies (status, severity);
CREATE INDEX IF NOT EXISTS idx_emergency_events_case ON emergency_events (emergency_id, event_time);
