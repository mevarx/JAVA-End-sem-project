package com.hospital.haes.web.sse;

import com.hospital.haes.model.Notifiable;
import com.hospital.haes.model.Notification;
import com.hospital.haes.service.NotificationService;
import com.hospital.haes.web.dto.NotificationDto;
import com.hospital.haes.web.mapper.ApiMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Bridges the in-process notification bus to browser Server-Sent Events.
 *
 * <p>{@link #receive(Notification)} is called from the emergency dispatcher and the
 * escalation timer, so it must never block: each send is isolated and a dead emitter is
 * dropped instead of propagating the failure.
 */
@Component
public class SseBridge implements Notifiable {

    private final NotificationService notificationService;
    private final ApiMapper mapper;
    private final Map<Integer, List<SseEmitter>> byUser = new ConcurrentHashMap<>();

    public SseBridge(NotificationService notificationService, ApiMapper mapper) {
        this.notificationService = notificationService;
        this.mapper = mapper;
    }

    @PostConstruct
    void register() {
        notificationService.addListener(this);
    }

    @PreDestroy
    void shutdown() {
        notificationService.removeListener(this);
        byUser.values().forEach(emitters -> emitters.forEach(SseEmitter::complete));
        byUser.clear();
    }

    public SseEmitter subscribe(int userId) {
        SseEmitter emitter = new SseEmitter(0L);
        byUser.computeIfAbsent(userId, key -> new CopyOnWriteArrayList<>()).add(emitter);
        Runnable cleanup = () -> remove(userId, emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(error -> cleanup.run());
        try {
            emitter.send(SseEmitter.event().comment("connected"));
        } catch (IOException | IllegalStateException e) {
            cleanup.run();
        }
        return emitter;
    }

    @Override
    public void receive(Notification notification) {
        NotificationDto dto = mapper.toDto(notification);
        if (notification.getTargetUserId() == 0) {
            byUser.values().forEach(emitters -> send(emitters, dto));
        } else {
            List<SseEmitter> emitters = byUser.get(notification.getTargetUserId());
            if (emitters != null) {
                send(emitters, dto);
            }
        }
    }

    @Scheduled(fixedRate = 15_000)
    public void heartbeat() {
        byUser.values().forEach(emitters -> {
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event().comment("ping"));
                } catch (IOException | IllegalStateException e) {
                    removeByEmitter(emitter);
                }
            }
        });
    }

    private void send(List<SseEmitter> emitters, NotificationDto dto) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("notification")
                        .data(dto, MediaType.APPLICATION_JSON));
            } catch (IOException | IllegalStateException e) {
                removeByEmitter(emitter);
            }
        }
    }

    private void remove(int userId, SseEmitter emitter) {
        List<SseEmitter> emitters = byUser.get(userId);
        if (emitters != null) {
            emitters.remove(emitter);
            if (emitters.isEmpty()) {
                byUser.remove(userId);
            }
        }
    }

    private void removeByEmitter(SseEmitter emitter) {
        byUser.forEach((userId, emitters) -> remove(userId, emitter));
    }
}
