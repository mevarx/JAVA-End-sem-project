package com.hospital.haes.model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * An unplanned case. Natural ordering is exactly the dispatch order:
 * severity first, then arrival time (FIFO inside a severity band).
 */
public class EmergencyCase extends Booking implements Comparable<EmergencyCase> {

    private static final DateTimeFormatter LOG_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private int id;
    private Integer patientId;
    private String patientLabel;
    private EmergencyType type;
    private Severity severity;
    private String location;
    private EmergencyStatus status;
    private Integer assignedTo;
    private String assignedToName;
    private Integer bedNo;
    private LocalDateTime raisedAt;
    private LocalDateTime dispatchedAt;
    private LocalDateTime acknowledgedAt;
    private LocalDateTime escalatedAt;
    private LocalDateTime resolvedAt;
    private int escalationCount;

    public EmergencyCase(int id, Integer patientId, String patientLabel,
                         EmergencyType type, Severity severity, String location,
                         EmergencyStatus status, Integer assignedTo, Integer bedNo,
                         LocalDateTime raisedAt, LocalDateTime dispatchedAt,
                         LocalDateTime acknowledgedAt, LocalDateTime escalatedAt,
                         LocalDateTime resolvedAt, int escalationCount) {
        this.id = id;
        this.patientId = patientId;
        this.patientLabel = patientLabel;
        this.type = type;
        this.severity = severity;
        this.location = location;
        this.status = status;
        this.assignedTo = assignedTo;
        this.bedNo = bedNo;
        this.raisedAt = raisedAt;
        this.dispatchedAt = dispatchedAt;
        this.acknowledgedAt = acknowledgedAt;
        this.escalatedAt = escalatedAt;
        this.resolvedAt = resolvedAt;
        this.escalationCount = escalationCount;
    }

    public static EmergencyCase waiting(Integer patientId, String patientLabel,
                                        EmergencyType type, Severity severity,
                                        String location, LocalDateTime raisedAt) {
        return new EmergencyCase(0, patientId, patientLabel, type, severity, location,
                EmergencyStatus.WAITING, null, null, raisedAt, null, null, null, null, 0);
    }

    @Override
    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public Integer getPatientId() {
        return patientId;
    }

    public void setPatientId(Integer patientId) {
        this.patientId = patientId;
    }

    public String getPatientLabel() {
        if (patientLabel != null && !patientLabel.isBlank()) {
            return patientLabel;
        }
        return patientId == null ? "Unknown" : "Patient #" + patientId;
    }

    public void setPatientLabel(String patientLabel) {
        this.patientLabel = patientLabel;
    }

    public EmergencyType getType() {
        return type;
    }

    public void setType(EmergencyType type) {
        this.type = type;
    }

    public Severity getSeverity() {
        return severity;
    }

    public void setSeverity(Severity severity) {
        this.severity = severity;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public EmergencyStatus getStatus() {
        return status;
    }

    public void setStatus(EmergencyStatus status) {
        this.status = status;
    }

    public Integer getAssignedTo() {
        return assignedTo;
    }

    public void setAssignedTo(Integer assignedTo) {
        this.assignedTo = assignedTo;
    }

    public String getAssignedToName() {
        return assignedToName;
    }

    public void setAssignedToName(String assignedToName) {
        this.assignedToName = assignedToName;
    }

    public Integer getBedNo() {
        return bedNo;
    }

    public void setBedNo(Integer bedNo) {
        this.bedNo = bedNo;
    }

    @Override
    public LocalDateTime getCreatedAt() {
        return raisedAt;
    }

    public LocalDateTime getRaisedAt() {
        return raisedAt;
    }

    public void setRaisedAt(LocalDateTime raisedAt) {
        this.raisedAt = raisedAt;
    }

    public LocalDateTime getDispatchedAt() {
        return dispatchedAt;
    }

    public void setDispatchedAt(LocalDateTime dispatchedAt) {
        this.dispatchedAt = dispatchedAt;
    }

    public LocalDateTime getAcknowledgedAt() {
        return acknowledgedAt;
    }

    public void setAcknowledgedAt(LocalDateTime acknowledgedAt) {
        this.acknowledgedAt = acknowledgedAt;
    }

    public LocalDateTime getEscalatedAt() {
        return escalatedAt;
    }

    public void setEscalatedAt(LocalDateTime escalatedAt) {
        this.escalatedAt = escalatedAt;
    }

    public LocalDateTime getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(LocalDateTime resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public int getEscalationCount() {
        return escalationCount;
    }

    public void setEscalationCount(int escalationCount) {
        this.escalationCount = escalationCount;
    }

    @Override
    public LocalDateTime getStart() {
        return raisedAt;
    }

    @Override
    public LocalDateTime getEnd() {
        return resolvedAt == null ? raisedAt.plusHours(1) : resolvedAt;
    }

    @Override
    public int getPriority() {
        return severity.getRank();
    }

    @Override
    public String getStatusLabel() {
        return status.getLabel();
    }

    @Override
    public String toLogLine() {
        return "EMERGENCY id=" + id
                + " severity=" + severity
                + " type=" + type
                + " location=" + location
                + " status=" + status
                + " assignedTo=" + (assignedTo == null ? "-" : assignedTo)
                + " bed=" + (bedNo == null ? "-" : bedNo)
                + " raisedAt=" + raisedAt.format(LOG_TIME);
    }

    @Override
    public int compareTo(EmergencyCase other) {
        int bySeverity = Integer.compare(getPriority(), other.getPriority());
        if (bySeverity != 0) {
            return bySeverity;
        }
        int byTime = raisedAt.compareTo(other.raisedAt);
        return byTime != 0 ? byTime : Integer.compare(id, other.id);
    }

    @Override
    public String toString() {
        return "#" + id + " " + severity + " " + type + " @ " + location;
    }
}
