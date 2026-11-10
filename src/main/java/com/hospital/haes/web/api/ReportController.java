package com.hospital.haes.web.api;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.model.Role;
import com.hospital.haes.service.ReportingService;
import com.hospital.haes.util.FileLogger;
import com.hospital.haes.util.Result;
import com.hospital.haes.web.dto.AuditLogDto;
import com.hospital.haes.web.dto.ReportResultDto;
import com.hospital.haes.web.security.RequireRole;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports")
@RequireRole(Role.ADMIN)
public class ReportController {

    private static final MediaType CSV = MediaType.parseMediaType("text/csv; charset=UTF-8");

    private final ReportingService reportingService;
    private final FileLogger auditLog;

    public ReportController(ReportingService reportingService, FileLogger auditLog) {
        this.reportingService = reportingService;
        this.auditLog = auditLog;
    }

    @GetMapping("/appointments.csv")
    public ResponseEntity<byte[]> appointmentsCsv() throws DatabaseOperationException, IOException {
        return csvDownload("appointments-" + LocalDate.now() + ".csv",
                target -> reportingService.exportAppointments(target));
    }

    @GetMapping("/emergencies.csv")
    public ResponseEntity<byte[]> emergenciesCsv() throws DatabaseOperationException, IOException {
        return csvDownload("emergencies-" + LocalDate.now() + ".csv",
                target -> reportingService.exportEmergencies(target));
    }

    @PostMapping("/slots/import")
    public ReportResultDto importSlots(@RequestParam("file") MultipartFile file)
            throws IOException, DatabaseOperationException {
        Path temp = Files.createTempFile("haes-slots-", ".csv");
        try {
            file.transferTo(temp.toFile());
            Result<Integer> result = reportingService.importSlots(temp);
            if (result.isSuccess()) {
                return new ReportResultDto(true, result.getValue(), null);
            }
            return new ReportResultDto(false, 0, result.getError());
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    @GetMapping("/audit-log")
    public AuditLogDto auditLog() throws IOException {
        Path path = auditLog.getLogFile();
        String content = Files.exists(path) ? Files.readString(path) : "";
        return new AuditLogDto(path.toString(), content);
    }

    private ResponseEntity<byte[]> csvDownload(String fileName, CsvWork work)
            throws DatabaseOperationException, IOException {
        Path temp = Files.createTempFile("haes-report-", ".csv");
        try {
            Result<Path> result = work.export(temp);
            if (!result.isSuccess()) {
                throw new DatabaseOperationException(result.getError());
            }
            byte[] body = Files.readAllBytes(temp);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + fileName + "\"")
                    .contentType(CSV)
                    .body(body);
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    @FunctionalInterface
    private interface CsvWork {
        Result<Path> export(Path target) throws DatabaseOperationException;
    }
}
