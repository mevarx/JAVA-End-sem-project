package com.hospital.haes.dao;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.model.Admin;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.AppointmentStatus;
import com.hospital.haes.model.Department;
import com.hospital.haes.model.Doctor;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.EmergencyEvent;
import com.hospital.haes.model.EmergencyStatus;
import com.hospital.haes.model.EmergencyType;
import com.hospital.haes.model.ErStaff;
import com.hospital.haes.model.Patient;
import com.hospital.haes.model.Receptionist;
import com.hospital.haes.model.Severity;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.SlotStatus;
import com.hospital.haes.util.PasswordHasher;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Invented demo data only. Never contains real patient information.
 */
public final class SampleData {

    private static final String PATIENT_PASSWORD = "patient123";
    private static final String DOCTOR_PASSWORD = "doctor123";

    private SampleData() {
    }

    public static void seedIfEmpty(DatabaseManager databaseManager,
                                   UserDao userDao,
                                   DepartmentDao departmentDao,
                                   SlotDao slotDao,
                                   AppointmentDao appointmentDao,
                                   EmergencyDao emergencyDao) throws DatabaseOperationException {
        if (!userDao.findAll().isEmpty()) {
            return;
        }

        Department general = departmentDao.save(new Department("General Medicine"));
        Department cardiology = departmentDao.save(new Department("Cardiology"));
        Department orthopedics = departmentDao.save(new Department("Orthopedics"));
        Department pulmonology = departmentDao.save(new Department("Pulmonology"));
        Department neurology = departmentDao.save(new Department("Neurology"));
        Department emergency = departmentDao.save(new Department("Emergency"));

        userDao.save(new Admin(0, "admin", PasswordHasher.hash("admin123"),
                "Hospital Administrator", "9000000001", general.getId(), true));
        userDao.save(new Receptionist(0, "reception", PasswordHasher.hash("reception123"),
                "Front Desk", "9000000002", general.getId(), true));
        userDao.save(new ErStaff(0, "er.patel", PasswordHasher.hash("er123"),
                "Nurse Patel", "9000000003", emergency.getId(), true));

        Patient anita = (Patient) userDao.save(new Patient(0, "patient.anita", PasswordHasher.hash(PATIENT_PASSWORD),
                "Anita Rao", "9000000010", null, true));
        Patient rahul = (Patient) userDao.save(new Patient(0, "patient.rahul", PasswordHasher.hash(PATIENT_PASSWORD),
                "Rahul Mehta", "9000000011", null, true));

        Doctor sharma = (Doctor) userDao.save(new Doctor(0, "dr.sharma", PasswordHasher.hash(DOCTOR_PASSWORD),
                "Dr. Meera Sharma", "9000000020", cardiology.getId(), true, "Cardiology", true));
        Doctor rao = (Doctor) userDao.save(new Doctor(0, "dr.rao", PasswordHasher.hash(DOCTOR_PASSWORD),
                "Dr. Arjun Rao", "9000000021", orthopedics.getId(), true, "Orthopedics", true));
        Doctor iyer = (Doctor) userDao.save(new Doctor(0, "dr.iyer", PasswordHasher.hash(DOCTOR_PASSWORD),
                "Dr. Lakshmi Iyer", "9000000022", pulmonology.getId(), true, "Pulmonology", true));
        Doctor khan = (Doctor) userDao.save(new Doctor(0, "dr.khan", PasswordHasher.hash(DOCTOR_PASSWORD),
                "Dr. Imran Khan", "9000000023", neurology.getId(), true, "Neurology", true));
        Doctor nair = (Doctor) userDao.save(new Doctor(0, "dr.nair", PasswordHasher.hash(DOCTOR_PASSWORD),
                "Dr. Kavya Nair", "9000000024", general.getId(), true, "General Medicine", true));

        List<Doctor> doctors = List.of(sharma, rao, iyer, khan, nair);
        seedSlots(slotDao, doctors);
        seedDemoAppointment(databaseManager, slotDao, appointmentDao, sharma, anita);
        seedResolvedEmergency(emergencyDao, sharma, rahul);
    }

    private static void seedSlots(SlotDao slotDao, List<Doctor> doctors) throws DatabaseOperationException {
        if (!slotDao.findAll().isEmpty()) {
            return;
        }
        LocalTime[] times = {
                LocalTime.of(9, 0),
                LocalTime.of(10, 30),
                LocalTime.of(14, 0),
                LocalTime.of(15, 30)
        };
        LocalDateTime earliest = LocalDateTime.now().plusMinutes(10);
        List<Slot> slots = new ArrayList<>();
        for (int dayOffset = 0; dayOffset < 7; dayOffset++) {
            LocalDate day = LocalDate.now().plusDays(dayOffset);
            for (Doctor doctor : doctors) {
                for (LocalTime time : times) {
                    LocalDateTime start = day.atTime(time);
                    LocalDateTime end = start.plusMinutes(30);
                    if (start.isBefore(earliest) || slotDao.hasOverlap(doctor.getId(), start, end, null)) {
                        continue;
                    }
                    slots.add(new Slot(0, doctor.getId(), start, end, SlotStatus.FREE));
                }
            }
        }
        for (Slot slot : slots) {
            slotDao.save(slot);
        }
    }

    private static void seedDemoAppointment(DatabaseManager databaseManager,
                                            SlotDao slotDao,
                                            AppointmentDao appointmentDao,
                                            Doctor doctor,
                                            Patient patient) throws DatabaseOperationException {
        List<Slot> tomorrow = slotDao.findAvailable(null, doctor.getId(), LocalDate.now().plusDays(1));
        if (tomorrow.isEmpty()) {
            return;
        }
        Slot slot = tomorrow.get(0);
        Appointment appointment = new Appointment(0, slot, patient.getId(),
                "Routine cardiac follow-up", AppointmentStatus.BOOKED, LocalDateTime.now());
        databaseManager.inTransaction(connection -> {
            appointmentDao.insert(connection, appointment);
            slotDao.updateStatus(connection, slot.getId(), SlotStatus.BOOKED);
            return null;
        });
    }

    private static void seedResolvedEmergency(EmergencyDao emergencyDao,
                                              Doctor doctor,
                                              Patient patient) throws DatabaseOperationException {
        LocalDateTime yesterday = LocalDate.now().minusDays(1).atTime(18, 23);
        EmergencyCase emergencyCase = new EmergencyCase(0, patient.getId(), patient.getFullName(),
                EmergencyType.CARDIAC, Severity.HIGH, "ER Gate", EmergencyStatus.RESOLVED,
                doctor.getId(), 3, yesterday, yesterday.plusMinutes(1),
                yesterday.plusMinutes(4), yesterday.plusMinutes(29), 0);
        emergencyDao.save(emergencyCase);
        emergencyDao.saveEvent(new EmergencyEvent(emergencyCase.getId(), "RAISED",
                yesterday, "Demo historical case"));
        emergencyDao.saveEvent(new EmergencyEvent(emergencyCase.getId(), "DISPATCHED",
                yesterday.plusMinutes(1), "Bed #3 reserved"));
        emergencyDao.saveEvent(new EmergencyEvent(emergencyCase.getId(), "ACKNOWLEDGED",
                yesterday.plusMinutes(4), "Acknowledged by Dr. Meera Sharma"));
        emergencyDao.saveEvent(new EmergencyEvent(emergencyCase.getId(), "RESOLVED",
                yesterday.plusMinutes(29), "Stabilised and admitted for observation"));
    }
}
