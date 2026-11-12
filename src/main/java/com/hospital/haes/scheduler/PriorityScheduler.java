package com.hospital.haes.scheduler;

import com.hospital.haes.model.Schedulable;

import java.util.concurrent.PriorityBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Generic priority scheduler reused for emergency dispatch and for the
 * appointment waitlist. The bound guarantees the element both has a time
 * window and a natural priority ordering.
 */
public class PriorityScheduler<T extends Schedulable & Comparable<T>> {

    private final PriorityBlockingQueue<T> queue = new PriorityBlockingQueue<>();

    public PriorityScheduler() {
    }

    public void offer(T item) {
        queue.offer(item);
    }

    public T poll(long timeout, TimeUnit unit) throws InterruptedException {
        return queue.poll(timeout, unit);
    }

    public T pollNow() {
        return queue.poll();
    }

    public int size() {
        return queue.size();
    }

    public void clear() {
        queue.clear();
    }

    public PriorityBlockingQueue<T> asQueue() {
        return queue;
    }
}
