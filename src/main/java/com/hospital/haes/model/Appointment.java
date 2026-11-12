package com.hospital.haes.model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class Appointment extends Booking implements Comparable<Appointment> {

    private static final DateTimeFormatter LOG_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private int id;
    private Slot slot;
    private int patientId;
    private String reason;
    private AppointmentStatus status;
    private LocalDateTime createdAt;
    private String patientName;
    private String doctorName;

    public Appointment(int id, Slot slot, int patientId, String reason,
                       AppointmentStatus status, LocalDateTime createdAt) {
        this.id = id;
        this.slot = slot;
        this.patientId = patientId;
        this.reason = reason;
        this.status = status;
        this.createdAt = createdAt;
    }

    @Override
    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public Slot getSlot() {
        return slot;
    }

    public int getSlotId() {
        return slot == null ? 0 : slot.getId();
    }

    public int getDoctorId() {
        return slot == null ? 0 : slot.getDoctorId();
    }

    public int getPatientId() {
        return patientId;
    }

    public String getReason() {
        return reason;
    }

    public AppointmentStatus getStatus() {
        return status;
    }

    public void setStatus(AppointmentStatus status) {
        this.status = status;
    }

    @Override
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    @Override
    public LocalDateTime getStart() {
        return slot == null ? createdAt : slot.getStart();
    }

    @Override
    public LocalDateTime getEnd() {
        return slot == null ? createdAt : slot.getEnd();
    }

    @Override
    public int getPriority() {
        // Appointments are routine work; emergencies always beat them.
        return 50;
    }

    @Override
    public String getStatusLabel() {
        return status.getLabel();
    }

    @Override
    public String toLogLine() {
        return "APPOINTMENT id=" + id
                + " slot=" + (slot == null ? "?" : slot.getId())
                + " patient=" + patientId
                + " status=" + status
                + " at=" + createdAt.format(LOG_TIME);
    }

    public String getPatientName() {
        return patientName == null ? "Patient #" + patientId : patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }

    public String getDoctorName() {
        if (doctorName != null) {
            return doctorName;
        }
        return slot == null ? "" : slot.getDoctorName();
    }

    public void setDoctorName(String doctorName) {
        this.doctorName = doctorName;
    }

    @Override
    public int compareTo(Appointment other) {
        int byTime = getCreatedAt().compareTo(other.getCreatedAt());
        return byTime != 0 ? byTime : Integer.compare(id, other.id);
    }

    @Override
    public String toString() {
        return "Appointment #" + id + " (" + getStatusLabel() + ")";
    }
}
