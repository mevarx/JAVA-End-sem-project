package com.hospital.haes.scheduler;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.OptionalInt;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BedPoolTest {

    @Test
    @DisplayName("Beds are unique and the pool stops at capacity")
    void acquiresUniqueBedsUntilCapacity() {
        BedPool pool = new BedPool(2);

        OptionalInt first = pool.tryAcquire();
        OptionalInt second = pool.tryAcquire();
        assertTrue(first.isPresent());
        assertTrue(second.isPresent());
        assertNotEquals(first.getAsInt(), second.getAsInt());
        assertEquals(0, pool.availableBeds());
        assertTrue(pool.tryAcquire().isEmpty());

        pool.release(first.getAsInt());
        assertEquals(1, pool.availableBeds());
        assertEquals(first.getAsInt(), pool.tryAcquire().orElseThrow());
    }

    @Test
    @DisplayName("Reserving a known bed on startup is safe and idempotent")
    void reservePreassignedBeds() {
        BedPool pool = new BedPool(3);

        assertTrue(pool.reserve(2));
        assertEquals(2, pool.availableBeds());
        assertFalse(pool.reserve(2));
        assertFalse(pool.reserve(0));
        assertFalse(pool.reserve(4));

        pool.release(2);
        assertEquals(3, pool.availableBeds());
        assertTrue(pool.reserve(2));
    }

    @Test
    @DisplayName("Invalid capacities and bed numbers are rejected")
    void validatesCapacityAndBedNumbers() {
        assertThrows(IllegalArgumentException.class, () -> new BedPool(0));
        assertThrows(IllegalArgumentException.class, () -> new BedPool(-1));

        BedPool pool = new BedPool(2);
        assertThrows(IllegalArgumentException.class, () -> pool.release(0));
        assertThrows(IllegalArgumentException.class, () -> pool.release(3));
        // Releasing a bed that is not occupied is harmless.
        pool.release(1);
        assertEquals(2, pool.availableBeds());
    }

    @Test
    @DisplayName("Concurrent acquisition never hands the same bed to two threads")
    void concurrentAcquisitionIsUnique() throws Exception {
        int capacity = 10;
        int threads = 30;
        BedPool pool = new BedPool(capacity);
        Set<Integer> handedOut = ConcurrentHashMap.newKeySet();
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();
        try {
            for (int i = 0; i < threads; i++) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    start.await(10, TimeUnit.SECONDS);
                    OptionalInt bed = pool.tryAcquire();
                    if (bed.isPresent()) {
                        handedOut.add(bed.getAsInt());
                    }
                    return null;
                }));
            }
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            for (Future<?> future : futures) {
                future.get(10, TimeUnit.SECONDS);
            }
        } finally {
            executor.shutdownNow();
        }

        assertEquals(capacity, handedOut.size());
        assertEquals(0, pool.availableBeds());
    }
}
