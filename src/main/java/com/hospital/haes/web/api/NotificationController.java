package com.hospital.haes.web.api;

import com.hospital.haes.service.NotificationService;
import com.hospital.haes.web.dto.NotificationDto;
import com.hospital.haes.web.mapper.ApiMapper;
import com.hospital.haes.web.security.CurrentUser;
import com.hospital.haes.web.sse.SseBridge;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final SseBridge sseBridge;
    private final ApiMapper mapper;

    public NotificationController(NotificationService notificationService,
                                  SseBridge sseBridge, ApiMapper mapper) {
        this.notificationService = notificationService;
        this.sseBridge = sseBridge;
        this.mapper = mapper;
    }

    @GetMapping
    public List<NotificationDto> history(HttpServletRequest request) {
        int userId = CurrentUser.of(request).userId();
        return notificationService.getHistoryFor(userId).stream()
                .map(mapper::toDto)
                .toList();
    }

    /** Live notification stream. Event name: "notification", data: NotificationDto. */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(HttpServletRequest request) {
        return sseBridge.subscribe(CurrentUser.of(request).userId());
    }
}
