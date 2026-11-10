package com.hospital.haes.web.config;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.service.AppointmentService;
import com.hospital.haes.service.AuthService;
import com.hospital.haes.service.DepartmentService;
import com.hospital.haes.service.EmergencyService;
import com.hospital.haes.service.NotificationService;
import com.hospital.haes.service.ReportingService;
import com.hospital.haes.service.UserService;
import com.hospital.haes.ui.AppContext;
import com.hospital.haes.util.FileLogger;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Builds the same composition root the JavaFX client uses and exposes its services
 * as beans, so controllers depend on services rather than on the composition root.
 */
@Configuration
public class AppConfig {

    @Bean
    public AppContext appContext(HaesProperties properties) {
        try {
            return AppContext.bootstrap(properties.getDb(), properties.getAudit());
        } catch (DatabaseOperationException e) {
            throw new IllegalStateException(
                    "Could not open the HAES database at " + properties.getDb() + ": " + e.getMessage(), e);
        }
    }

    @Bean
    public AuthService authService(AppContext context) {
        return context.authService();
    }

    @Bean
    public UserService userService(AppContext context) {
        return context.userService();
    }

    @Bean
    public DepartmentService departmentService(AppContext context) {
        return context.departmentService();
    }

    @Bean
    public AppointmentService appointmentService(AppContext context) {
        return context.appointmentService();
    }

    @Bean
    public EmergencyService emergencyService(AppContext context) {
        return context.emergencyService();
    }

    @Bean
    public NotificationService notificationService(AppContext context) {
        return context.notificationService();
    }

    @Bean
    public ReportingService reportingService(AppContext context) {
        return context.reportingService();
    }

    @Bean
    public FileLogger auditLog(AppContext context) {
        return context.auditLog();
    }
}
