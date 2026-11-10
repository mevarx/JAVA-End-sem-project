package com.hospital.haes.web.api;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.SlotConflictException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.Slot;
import com.hospital.haes.service.AppointmentService;
import com.hospital.haes.web.dto.DefineAvailabilityRequest;
import com.hospital.haes.web.dto.SlotDto;
import com.hospital.haes.web.mapper.ApiMapper;
import com.hospital.haes.web.security.CurrentUser;
import com.hospital.haes.web.security.RequireRole;
import com.hospital.haes.web.security.WebSession;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/slots")
public class SlotController {

    private final AppointmentService appointmentService;
    private final ApiMapper mapper;

    public SlotController(AppointmentService appointmentService, ApiMapper mapper) {
        this.appointmentService = appointmentService;
        this.mapper = mapper;
    }

    @GetMapping("/available")
    public List<SlotDto> available(
            @RequestParam(required = false) Integer departmentId,
            @RequestParam(required = false) Integer doctorId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date)
            throws DatabaseOperationException {
        LocalDate day = date == null ? LocalDate.now() : date;
        return appointmentService.findAvailableSlots(departmentId, doctorId, day)
                .stream().map(mapper::toDto).toList();
    }

    @GetMapping("/mine")
    @RequireRole(Role.DOCTOR)
    public List<SlotDto> mine(HttpServletRequest request) throws DatabaseOperationException {
        WebSession session = CurrentUser.of(request);
        return appointmentService.listDoctorSlots(session.userId())
                .stream().map(mapper::toDto).toList();
    }

    @PostMapping
    @RequireRole(Role.DOCTOR)
    public ResponseEntity<SlotDto> publish(@RequestBody DefineAvailabilityRequest request,
                                           HttpServletRequest httpRequest)
            throws ValidationException, DatabaseOperationException, SlotConflictException {
        if (request.start() == null || request.end() == null) {
            throw new ValidationException("Choose a start and end time.");
        }
        WebSession session = CurrentUser.of(httpRequest);
        Slot slot = appointmentService.defineAvailability(session.userId(), request.start(), request.end());
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toDto(slot));
    }

    @DeleteMapping("/{id}")
    @RequireRole({Role.DOCTOR, Role.ADMIN})
    public ResponseEntity<Void> remove(@PathVariable int id, HttpServletRequest request)
            throws DatabaseOperationException, UnauthorizedActionException,
            SlotConflictException, ValidationException {
        WebSession session = CurrentUser.of(request);
        if (session.role() == Role.DOCTOR) {
            boolean owns = appointmentService.listDoctorSlots(session.userId()).stream()
                    .anyMatch(slot -> slot.getId() == id);
            if (!owns) {
                throw new UnauthorizedActionException("You can only remove your own slots.");
            }
        }
        appointmentService.removeSlot(id);
        return ResponseEntity.noContent().build();
    }
}
