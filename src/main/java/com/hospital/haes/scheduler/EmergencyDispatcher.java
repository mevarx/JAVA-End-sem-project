package com.hospital.haes.scheduler;

import com.hospital.haes.model.EmergencyCase;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Background worker that consumes the priority queue and asks the emergency
 * service to dispatch each case. If a case cannot be dispatched (no bed or
 * responder), it is put back and retried after a short pause without losing
 * its priority position.
 */
public class EmergencyDispatcher implements AutoCloseable {

    @FunctionalInterface
    public interface DispatchHandler {
        /** @return true when the case left the queue (assigned or no longer active). */
        boolean tryDispatch(EmergencyCase emergencyCase);
    }

    private final PriorityScheduler<EmergencyCase> queue;
    private final DispatchHandler handler;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final ReentrantLock dispatchLock = new ReentrantLock();
    private volatile Thread worker;

    public EmergencyDispatcher(PriorityScheduler<EmergencyCase> queue, DispatchHandler handler) {
        this.queue = queue;
        this.handler = handler;
    }

    public void start() {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        worker = new Thread(this::loop, "EmergencyDispatcherThread");
        worker.setDaemon(true);
        worker.start();
    }

    public void stop() {
        running.set(false);
        Thread thread = worker;
        if (thread != null) {
            thread.interrupt();
            try {
                thread.join(2_000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private void loop() {
        while (running.get()) {
            try {
                EmergencyCase next = queue.poll(500, TimeUnit.MILLISECONDS);
                if (next == null) {
                    continue;
                }
                boolean handled;
                dispatchLock.lock();
                try {
                    handled = handler.tryDispatch(next);
                } finally {
                    dispatchLock.unlock();
                }
                if (!handled) {
                    // Always put the case back, even while stopping: dropping it here would
                    // lose an in-flight emergency from the live queue.
                    queue.offer(next);
                    if (running.get()) {
                        Thread.sleep(300);
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (RuntimeException e) {
                System.err.println("Dispatcher error: " + e.getMessage());
            }
        }
    }

    /**
     * Synchronous pass used by tests and the "Dispatch now" admin action.
     * Processes each queued case at most once.
     */
    public int dispatchAvailable() {
        dispatchLock.lock();
        try {
            int attempts = queue.size();
            int dispatched = 0;
            for (int i = 0; i < attempts; i++) {
                EmergencyCase next = queue.pollNow();
                if (next == null) {
                    break;
                }
                if (handler.tryDispatch(next)) {
                    dispatched++;
                } else {
                    queue.offer(next);
                }
            }
            return dispatched;
        } finally {
            dispatchLock.unlock();
        }
    }

    @Override
    public void close() {
        stop();
    }
}
