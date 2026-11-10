package com.hospital.haes.web.api;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.InvalidBookingException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.EmergencyStatus;
import com.hospital.haes.model.EmergencyType;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.Severity;
import com.hospital.haes.service.EmergencyService;
import com.hospital.haes.web.dto.DispatchResultDto;
import com.hospital.haes.web.dto.EmergencyBoardDto;
import com.hospital.haes.web.dto.EmergencyCaseDto;
import com.hospital.haes.web.dto.EmergencyEventDto;
import com.hospital.haes.web.dto.RaiseEmergencyRequest;
import com.hospital.haes.web.dto.ResolveRequest;
import com.hospital.haes.web.dto.StatsDto;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.OptionalDouble;

@RestController
@RequestMapping("/api/emergencies")
public class EmergencyController {

    private final EmergencyService emergencyService;
    private final ApiMapper mapper;

    public EmergencyController(EmergencyService emergencyService, ApiMapper mapper) {
        this.emergencyService = emergencyService;
        this.mapper = mapper;
    }

    @PostMapping
    public ResponseEntity<EmergencyCaseDto> raise(@RequestBody RaiseEmergencyRequest request,
                                                  HttpServletRequest httpRequest)
            throws ValidationException, DatabaseOperationException {
        if (request.type() == null || request.severity() == null) {
            throw new ValidationException("Select an emergency type and severity.");
        }
        WebSession session = CurrentUser.of(httpRequest);
        Integer patientId = request.patientId();
        String label = request.patientLabel();
        if (session.role() == Role.PATIENT) {
            patientId = session.userId();
            label = session.fullName();
        }
        EmergencyCase raised = emergencyService.raiseEmergency(
                patientId, label, EmergencyType.valueOf(request.type()),
                Severity.valueOf(request.severity()), request.location(), session.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toDto(raised));
    }

    @GetMapping("/board")
    @RequireRole({Role.DOCTOR, Role.ER_STAFF, Role.RECEPTIONIST, Role.ADMIN})
    public EmergencyBoardDto board(@RequestParam(defaultValue = "active") String scope,
                                   HttpServletRequest httpRequest)
            throws DatabaseOperationException {
        WebSession session = CurrentUser.of(httpRequest);
        List<EmergencyCase> cases = "all".equalsIgnoreCase(scope)
                ? emergencyService.getAllCases()
                : emergencyService.getActiveCases();
        if (session.role() == Role.DOCTOR) {
            cases = cases.stream()
                    .filter(emergency -> emergency.getAssignedTo() != null
                            && emergency.getAssignedTo() == session.userId())
                    .filter(emergency -> emergency.getStatus() != EmergencyStatus.RESOLVED)
                    .toList();
        }
        return boardOf(cases);
    }

    @GetMapping("/mine")
    @RequireRole(Role.PATIENT)
    public List<EmergencyCaseDto> mine(HttpServletRequest request) throws DatabaseOperationException {
        WebSession session = CurrentUser.of(request);
        return emergencyService.findByPatient(session.userId())
                .stream().map(mapper::toDto).toList();
    }

    @GetMapping("/{id}")
    public EmergencyCaseDto get(@PathVariable int id, HttpServletRequest request)
            throws DatabaseOperationException, InvalidBookingException, UnauthorizedActionException {
        WebSession session = CurrentUser.of(request);
        EmergencyCase emergencyCase = emergencyService.findById(id)
                .orElseThrow(() -> new InvalidBookingException("Emergency case not found."));
        requireVisible(session, emergencyCase);
        return mapper.toDto(emergencyCase);
    }

    @GetMapping("/{id}/events")
    public List<EmergencyEventDto> events(@PathVariable int id, HttpServletRequest request)
            throws DatabaseOperationException, InvalidBookingException, UnauthorizedActionException {
        WebSession session = CurrentUser.of(request);
        EmergencyCase emergencyCase = emergencyService.findById(id)
                .orElseThrow(() -> new InvalidBookingException("Emergency case not found."));
        requireVisible(session, emergencyCase);
        return emergencyService.getEvents(id).stream().map(mapper::toDto).toList();
    }

    @PostMapping("/{id}/acknowledge")
    @RequireRole({Role.DOCTOR, Role.ER_STAFF})
    public EmergencyCaseDto acknowledge(@PathVariable int id, HttpServletRequest request)
            throws DatabaseOperationException, InvalidBookingException, UnauthorizedActionException {
        WebSession session = CurrentUser.of(request);
        return mapper.toDto(emergencyService.acknowledge(id, session.userId()));
    }

    @PostMapping("/{id}/resolve")
    @RequireRole({Role.DOCTOR, Role.ER_STAFF, Role.ADMIN})
    public EmergencyCaseDto resolve(@PathVariable int id, @RequestBody ResolveRequest request,
                                    HttpServletRequest httpRequest)
            throws DatabaseOperationException, InvalidBookingException, UnauthorizedActionException {
        WebSession session = CurrentUser.of(httpRequest);
        return mapper.toDto(emergencyService.resolve(
                id, session.userId(), session.role(), request.note()));
    }

    @PostMapping("/dispatch")
    @RequireRole({Role.ER_STAFF, Role.ADMIN})
    public DispatchResultDto dispatch() {
        return new DispatchResultDto(emergencyService.dispatchPendingNow());
    }

    @GetMapping("/events/recent")
    @RequireRole({Role.ADMIN, Role.ER_STAFF})
    public List<EmergencyEventDto> recentEvents(@RequestParam(defaultValue = "25") int limit)
            throws DatabaseOperationException {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return emergencyService.getRecentEvents(safeLimit).stream().map(mapper::toDto).toList();
    }

    @GetMapping("/stats")
    @RequireRole({Role.ER_STAFF, Role.RECEPTIONIST, Role.ADMIN})
    public StatsDto stats() throws DatabaseOperationException {
        OptionalDouble average = emergencyService.getAverageDispatchMillis();
        return new StatsDto(
                emergencyService.getQueueSize(),
                emergencyService.getBedPool().availableBeds(),
                emergencyService.getBedPool().getCapacity(),
                average.isPresent() ? average.getAsDouble() : null);
    }

    private EmergencyBoardDto boardOf(List<EmergencyCase> cases) throws DatabaseOperationException {
        OptionalDouble average = emergencyService.getAverageDispatchMillis();
        return new EmergencyBoardDto(
                cases.stream().map(mapper::toDto).toList(),
                emergencyService.getQueueSize(),
                emergencyService.getBedPool().availableBeds(),
                emergencyService.getBedPool().getCapacity(),
                average.isPresent() ? average.getAsDouble() : null);
    }

    private void requireVisible(WebSession session, EmergencyCase emergencyCase)
            throws UnauthorizedActionException {
        if (session.role() == Role.PATIENT
                && (emergencyCase.getPatientId() == null
                || emergencyCase.getPatientId() != session.userId())) {
            throw new UnauthorizedActionException("This emergency is not yours.");
        }
    }
}
