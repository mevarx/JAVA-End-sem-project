package com.hospital.haes.scheduler;

import java.util.OptionalInt;
import java.util.Queue;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Semaphore;

/**
 * Limited ER bed pool shared by dispatcher threads. The semaphore enforces
 * the capacity; the queue hands out concrete bed numbers so two cases can
 * never be told they own the same bed.
 */
public class BedPool {

    private final int capacity;
    private final Semaphore permits;
    private final Queue<Integer> freeBeds = new ConcurrentLinkedQueue<>();
    private final Set<Integer> occupied = ConcurrentHashMap.newKeySet();

    public BedPool(int capacity) {
        if (capacity < 1) {
            throw new IllegalArgumentException("Bed capacity must be at least 1");
        }
        this.capacity = capacity;
        this.permits = new Semaphore(capacity, true);
        for (int bed = 1; bed <= capacity; bed++) {
            freeBeds.offer(bed);
        }
    }

    public OptionalInt tryAcquire() {
        if (!permits.tryAcquire()) {
            return OptionalInt.empty();
        }
        Integer bed = freeBeds.poll();
        if (bed == null) {
            permits.release();
            return OptionalInt.empty();
        }
        occupied.add(bed);
        return OptionalInt.of(bed);
    }

    /**
     * Marks an already-assigned bed as occupied when active cases are reloaded
     * from the database at startup.
     */
    public boolean reserve(int bedNo) {
        if (bedNo < 1 || bedNo > capacity || occupied.contains(bedNo)) {
            return false;
        }
        if (!freeBeds.remove(bedNo)) {
            return false;
        }
        if (!permits.tryAcquire()) {
            freeBeds.offer(bedNo);
            return false;
        }
        occupied.add(bedNo);
        return true;
    }

    public void release(int bedNo) {
        if (bedNo < 1 || bedNo > capacity) {
            throw new IllegalArgumentException("Unknown bed number: " + bedNo);
        }
        if (occupied.remove(bedNo)) {
            freeBeds.offer(bedNo);
            permits.release();
        }
    }

    public int availableBeds() {
        return permits.availablePermits();
    }

    public int getCapacity() {
        return capacity;
    }
}
