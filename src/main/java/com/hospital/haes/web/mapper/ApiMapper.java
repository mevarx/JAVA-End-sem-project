package com.hospital.haes.web.mapper;

import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.Department;
import com.hospital.haes.model.Doctor;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.EmergencyEvent;
import com.hospital.haes.model.Notification;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.User;
import com.hospital.haes.web.dto.AppointmentDto;
import com.hospital.haes.web.dto.DepartmentDto;
import com.hospital.haes.web.dto.EmergencyCaseDto;
import com.hospital.haes.web.dto.EmergencyEventDto;
import com.hospital.haes.web.dto.NotificationDto;
import com.hospital.haes.web.dto.SlotDto;
import com.hospital.haes.web.dto.UserDto;
import org.springframework.stereotype.Component;

/**
 * The only place domain objects become JSON. In particular, {@link User} is never
 * serialised directly because it exposes {@code getPasswordHash()}.
 */
@Component
public class ApiMapper {

    public UserDto toDto(User user) {
        if (user == null) {
            return null;
        }
        Boolean onCall = user instanceof Doctor doctor ? doctor.isOnCall() : null;
        return new UserDto(
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getPhone(),
                user.getDepartmentId(),
                user.isActive(),
                user.getRole().name(),
                user.getSpecialization(),
                onCall);
    }

    public DepartmentDto toDto(Department department) {
        return department == null ? null : new DepartmentDto(department.getId(), department.getName());
    }

    public SlotDto toDto(Slot slot) {
        if (slot == null) {
            return null;
        }
        return new SlotDto(
                slot.getId(),
                slot.getDoctorId(),
                slot.getDoctorName(),
                slot.getDepartmentId(),
                slot.getDepartmentName(),
                slot.getStart(),
                slot.getEnd(),
                slot.getStatus().name());
    }

    public AppointmentDto toDto(Appointment appointment) {
        if (appointment == null) {
            return null;
        }
        return new AppointmentDto(
                appointment.getId(),
                appointment.getSlotId(),
                appointment.getPatientId(),
                appointment.getPatientName(),
                appointment.getDoctorId(),
                appointment.getDoctorName(),
                appointment.getStart(),
                appointment.getEnd(),
                appointment.getReason(),
                appointment.getStatus().name(),
                appointment.getStatusLabel(),
                appointment.getCreatedAt());
    }

    public EmergencyCaseDto toDto(EmergencyCase emergencyCase) {
        if (emergencyCase == null) {
            return null;
        }
        return new EmergencyCaseDto(
                emergencyCase.getId(),
                emergencyCase.getPatientId(),
                emergencyCase.getPatientLabel(),
                emergencyCase.getType().name(),
                emergencyCase.getType().getLabel(),
                emergencyCase.getSeverity().name(),
                emergencyCase.getSeverity().getLabel(),
                emergencyCase.getLocation(),
                emergencyCase.getStatus().name(),
                emergencyCase.getStatusLabel(),
                emergencyCase.getAssignedTo(),
                emergencyCase.getAssignedToName(),
                emergencyCase.getBedNo(),
                emergencyCase.getRaisedAt(),
                emergencyCase.getDispatchedAt(),
                emergencyCase.getAcknowledgedAt(),
                emergencyCase.getEscalatedAt(),
                emergencyCase.getResolvedAt(),
                emergencyCase.getEscalationCount());
    }

    public EmergencyEventDto toDto(EmergencyEvent event) {
        if (event == null) {
            return null;
        }
        return new EmergencyEventDto(
                event.getId(),
                event.getEmergencyId(),
                event.getEventType(),
                event.getEventTime(),
                event.getNote());
    }

    public NotificationDto toDto(Notification notification) {
        if (notification == null) {
            return null;
        }
        return new NotificationDto(
                notification.getId(),
                notification.getTargetUserId(),
                notification.getMessage(),
                notification.getLevel().name(),
                notification.getTimestamp());
    }
}
