package com.hospital.haes.service;

import com.hospital.haes.model.Notification;
import com.hospital.haes.model.NotificationLevel;
import com.hospital.haes.model.Notifiable;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Thread-safe in-app event bus. Background threads call notify/broadcast;
 * the UI registers a Notifiable and marshals updates onto the JavaFX thread.
 * History is capped to avoid unbounded memory growth.
 */
public class NotificationService {

    private static final int MAX_HISTORY = 200;

    private final AtomicInteger sequence = new AtomicInteger();
    private final ConcurrentLinkedDeque<Notification> history = new ConcurrentLinkedDeque<>();
    private final CopyOnWriteArrayList<Notifiable> listeners = new CopyOnWriteArrayList<>();

    public void addListener(Notifiable listener) {
        if (listener != null) {
            listeners.addIfAbsent(listener);
        }
    }

    public void removeListener(Notifiable listener) {
        listeners.remove(listener);
    }

    public Notification notifyUser(int userId, String message, NotificationLevel level) {
        return publish(new Notification(
                sequence.incrementAndGet(), userId, message, level, LocalDateTime.now()));
    }

    /** targetUserId = 0 means every signed-in user sees the notification. */
    public Notification broadcast(String message, NotificationLevel level) {
        return publish(new Notification(
                sequence.incrementAndGet(), 0, message, level, LocalDateTime.now()));
    }

    private Notification publish(Notification notification) {
        history.addFirst(notification);
        while (history.size() > MAX_HISTORY) {
            history.pollLast();
        }
        for (Notifiable listener : listeners) {
            try {
                listener.receive(notification);
            } catch (RuntimeException e) {
                System.err.println("Notification listener failed: " + e.getMessage());
            }
        }
        return notification;
    }

    public List<Notification> getHistoryFor(int userId) {
        List<Notification> visible = new ArrayList<>();
        for (Notification notification : history) {
            if (notification.getTargetUserId() == 0 || notification.getTargetUserId() == userId) {
                visible.add(notification);
            }
        }
        return visible;
    }

    public List<Notification> getHistory() {
        return new ArrayList<>(history);
    }
}
