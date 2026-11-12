package com.hospital.haes.model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * A bookable window of doctor availability.
 */
public class Slot implements Schedulable {

    public static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

    private int id;
    private int doctorId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private SlotStatus status;
    private String doctorName;
    private String departmentName;
    private Integer departmentId;

    public Slot(int id, int doctorId, LocalDateTime startTime, LocalDateTime endTime,
                SlotStatus status) {
        this.id = id;
        this.doctorId = doctorId;
        this.startTime = startTime;
        this.endTime = endTime;
        this.status = status;
    }

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public int getDoctorId() {
        return doctorId;
    }

    @Override
    public LocalDateTime getStart() {
        return startTime;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    @Override
    public LocalDateTime getEnd() {
        return endTime;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public SlotStatus getStatus() {
        return status;
    }

    public void setStatus(SlotStatus status) {
        this.status = status;
    }

    public String getDoctorName() {
        return doctorName == null ? "Doctor #" + doctorId : doctorName;
    }

    public void setDoctorName(String doctorName) {
        this.doctorName = doctorName;
    }

    public String getDepartmentName() {
        return departmentName == null ? "" : departmentName;
    }

    public void setDepartmentName(String departmentName) {
        this.departmentName = departmentName;
    }

    public Integer getDepartmentId() {
        return departmentId;
    }

    public void setDepartmentId(Integer departmentId) {
        this.departmentId = departmentId;
    }

    public String getTimeRangeLabel() {
        return startTime.format(TIME_FORMAT) + " - " + endTime.format(TIME_FORMAT);
    }

    @Override
    public String toString() {
        return getTimeRangeLabel() + " with " + getDoctorName();
    }
}
