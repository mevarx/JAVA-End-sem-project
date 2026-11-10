package com.hospital.haes.web.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

/**
 * Configuration shared with the desktop client. Defaults match the files the
 * JavaFX entry point creates, so both clients open the same database.
 */
@ConfigurationProperties(prefix = "haes")
public class HaesProperties {

    private Path db = Path.of("haes.db");
    private Path audit = Path.of("emergency_audit.log");
    private final Emergency emergency = new Emergency();

    public Path getDb() {
        return db;
    }

    public void setDb(Path db) {
        this.db = db;
    }

    public Path getAudit() {
        return audit;
    }

    public void setAudit(Path audit) {
        this.audit = audit;
    }

    public Emergency getEmergency() {
        return emergency;
    }

    public static class Emergency {

        /** Tests disable this so they control the dispatcher threads explicitly. */
        private boolean autoStart = true;

        public boolean isAutoStart() {
            return autoStart;
        }

        public void setAutoStart(boolean autoStart) {
            this.autoStart = autoStart;
        }
    }
}
