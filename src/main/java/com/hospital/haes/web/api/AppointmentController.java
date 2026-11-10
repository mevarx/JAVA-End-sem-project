package com.hospital.haes.web.api;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.InvalidBookingException;
import com.hospital.haes.exception.SlotConflictException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.AppointmentStatus;
import com.hospital.haes.model.Role;
import com.hospital.haes.service.AppointmentService;
import com.hospital.haes.web.dto.AppointmentDto;
import com.hospital.haes.web.dto.BookRequest;
import com.hospital.haes.web.dto.LimitsDto;
import com.hospital.haes.web.dto.RescheduleRequest;
import com.hospital.haes.web.dto.StatusChangeRequest;
import com.hospital.haes.web.mapper.ApiMapper;
import com.hospital.haes.web.security.CurrentUser;
import com.hospital.haes.web.security.RequireRole;
import com.hospital.haes.web.security.WebSession;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    private final AppointmentService appointmentService;
    private final ApiMapper mapper;

    public AppointmentController(AppointmentService appointmentService, ApiMapper mapper) {
        this.appointmentService = appointmentService;
        this.mapper = mapper;
    }

    /** Patients and doctors always see their own list; staff see everything. */
    @GetMapping
    public List<AppointmentDto> list(HttpServletRequest request) throws DatabaseOperationException {
        WebSession session = CurrentUser.of(request);
        List<Appointment> appointments = switch (session.role()) {
            case PATIENT -> appointmentService.listByPatient(session.userId());
            case DOCTOR -> appointmentService.listByDoctor(session.userId());
            default -> appointmentService.listAll();
        };
        return appointments.stream().map(mapper::toDto).toList();
    }

    @PostMapping
    public ResponseEntity<AppointmentDto> book(@RequestBody BookRequest request,
                                               HttpServletRequest httpRequest)
            throws ValidationException, DatabaseOperationException,
            InvalidBookingException, SlotConflictException, UnauthorizedActionException {
        WebSession session = CurrentUser.of(httpRequest);
        if (session.role() == Role.DOCTOR || session.role() == Role.ER_STAFF) {
            throw new UnauthorizedActionException("Only patients, reception or an admin can book.");
        }
        Integer patientId = request.patientId();
        if (session.role() == Role.PATIENT) {
            // The patient id must come from the session, never from the request body.
            patientId = session.userId();
        }
        if (patientId == null) {
            throw new ValidationException("Select a patient.");
        }
        Appointment appointment = appointmentService.book(patientId, request.slotId(), request.reason());
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toDto(appointment));
    }

    @PostMapping("/{id}/reschedule")
    public AppointmentDto reschedule(@PathVariable int id, @RequestBody RescheduleRequest request,
                                     HttpServletRequest httpRequest)
            throws DatabaseOperationException, InvalidBookingException,
            SlotConflictException, UnauthorizedActionException {
        WebSession session = CurrentUser.of(httpRequest);
        Appointment replacement = appointmentService.reschedule(
                id, request.newSlotId(), session.userId(), session.role());
        return mapper.toDto(replacement);
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<Void> cancel(@PathVariable int id, HttpServletRequest httpRequest)
            throws DatabaseOperationException, InvalidBookingException, UnauthorizedActionException {
        WebSession session = CurrentUser.of(httpRequest);
        appointmentService.cancel(id, session.userId(), session.role());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/status")
    @RequireRole({Role.DOCTOR, Role.ADMIN})
    public ResponseEntity<Void> changeStatus(@PathVariable int id,
                                             @RequestBody StatusChangeRequest request,
                                             HttpServletRequest httpRequest)
            throws DatabaseOperationException, InvalidBookingException,
            UnauthorizedActionException, ValidationException {
        if (request.status() == null) {
            throw new ValidationException("Select a status.");
        }
        WebSession session = CurrentUser.of(httpRequest);
        appointmentService.changeStatus(id, session.userId(), session.role(),
                AppointmentStatus.valueOf(request.status()));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/waitlist")
    @RequireRole({Role.RECEPTIONIST, Role.ADMIN})
    public List<AppointmentDto> waitlist() throws DatabaseOperationException {
        return appointmentService.getWaitlistSnapshot().stream().map(mapper::toDto).toList();
    }

    @GetMapping("/limits")
    public LimitsDto limits() {
        return new LimitsDto(appointmentService.getMaxActiveAppointments());
    }
}
