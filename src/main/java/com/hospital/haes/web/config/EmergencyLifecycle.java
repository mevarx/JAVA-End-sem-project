package com.hospital.haes.web.config;

import com.hospital.haes.ui.AppContext;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

/**
 * Starts the emergency dispatcher and escalation timer with the web server and stops
 * them (via {@link AppContext#shutdown()}) on context close. Phase MAX_VALUE so the
 * database-backed services are fully wired before background threads begin.
 */
@Component
public class EmergencyLifecycle implements SmartLifecycle {

    private final AppContext context;
    private final boolean autoStart;
    private volatile boolean running;

    public EmergencyLifecycle(AppContext context, HaesProperties properties) {
        this.context = context;
        this.autoStart = properties.getEmergency().isAutoStart();
    }

    @Override
    public void start() {
        if (!autoStart || running) {
            return;
        }
        context.emergencyService().start();
        running = true;
    }

    @Override
    public void stop() {
        if (!running) {
            return;
        }
        context.shutdown();
        running = false;
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    @Override
    public int getPhase() {
        return Integer.MAX_VALUE;
    }
}
