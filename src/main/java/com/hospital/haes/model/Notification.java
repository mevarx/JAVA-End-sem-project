package com.hospital.haes.model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class Notification {

    private static final DateTimeFormatter DISPLAY_TIME =
            DateTimeFormatter.ofPattern("HH:mm:ss");

    private final int id;
    private final int targetUserId;
    private final String message;
    private final NotificationLevel level;
    private final LocalDateTime timestamp;

    public Notification(int id, int targetUserId, String message,
                        NotificationLevel level, LocalDateTime timestamp) {
        this.id = id;
        this.targetUserId = targetUserId;
        this.message = message;
        this.level = level;
        this.timestamp = timestamp;
    }

    public int getId() {
        return id;
    }

    public int getTargetUserId() {
        return targetUserId;
    }

    public String getMessage() {
        return message;
    }

    public NotificationLevel getLevel() {
        return level;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public String getTimeLabel() {
        return timestamp.format(DISPLAY_TIME);
    }

    @Override
    public String toString() {
        return "[" + getTimeLabel() + "] " + message;
    }
}
