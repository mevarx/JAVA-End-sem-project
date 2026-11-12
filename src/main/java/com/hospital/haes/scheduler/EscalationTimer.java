package com.hospital.haes.scheduler;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Runs the acknowledgement-deadline scan on a dedicated daemon thread.
 * The service owns the escalation rules; this class only owns scheduling.
 */
public class EscalationTimer implements AutoCloseable {

    private final ScheduledExecutorService executor =
            Executors.newSingleThreadScheduledExecutor(runnable -> {
                Thread thread = new Thread(runnable, "EscalationTimerThread");
                thread.setDaemon(true);
                return thread;
            });

    private ScheduledFuture<?> future;

    public synchronized void start(Runnable scanTask, long periodSeconds) {
        if (future != null && !future.isDone()) {
            return;
        }
        future = executor.scheduleAtFixedRate(safe(scanTask), periodSeconds, periodSeconds, TimeUnit.SECONDS);
    }

    public synchronized void stop() {
        if (future != null) {
            future.cancel(false);
            future = null;
        }
    }

    private Runnable safe(Runnable task) {
        return () -> {
            try {
                task.run();
            } catch (RuntimeException e) {
                System.err.println("Escalation scan failed: " + e.getMessage());
            }
        };
    }

    @Override
    public void close() {
        stop();
        executor.shutdownNow();
    }
}
