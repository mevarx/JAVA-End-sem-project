package com.hospital.haes.scheduler;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Per-slot locks make the check-then-insert booking sequence atomic. Two
 * patients trying the same slot are serialised; the second one re-reads the
 * slot inside its lock and receives a conflict instead of a double booking.
 */
public class SlotLockManager {

    private final ConcurrentHashMap<Integer, ReentrantLock> locks = new ConcurrentHashMap<>();

    public void lock(int slotId) {
        lockFor(slotId).lock();
    }

    public void unlock(int slotId) {
        ReentrantLock lock = locks.get(slotId);
        if (lock != null && lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }

    private ReentrantLock lockFor(int slotId) {
        return locks.computeIfAbsent(slotId, id -> new ReentrantLock(true));
    }
}
