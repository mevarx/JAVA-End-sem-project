package com.hospital.haes.scheduler;

import com.hospital.haes.model.Schedulable;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.PriorityBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Generic priority scheduler reused for emergency dispatch and for the
 * appointment waitlist. The bound guarantees the element both has a time
 * window and a natural priority ordering.
 */
public class PriorityScheduler<T extends Schedulable & Comparable<T>> {

    private final PriorityBlockingQueue<T> queue;

    public PriorityScheduler() {
        this.queue = new PriorityBlockingQueue<>();
    }

    public PriorityScheduler(Comparator<T> comparator) {
        this.queue = new PriorityBlockingQueue<>(11, comparator);
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

    public T peek() {
        return queue.peek();
    }

    public int size() {
        return queue.size();
    }

    public boolean isEmpty() {
        return queue.isEmpty();
    }

    public boolean remove(T item) {
        return queue.remove(item);
    }

    public void clear() {
        queue.clear();
    }

    /** Stable snapshot in priority order; used by tests and the UI. */
    public List<T> snapshot() {
        List<T> copy = new ArrayList<>(queue);
        copy.sort(Comparator.naturalOrder());
        return copy;
    }

    public PriorityBlockingQueue<T> asQueue() {
        return queue;
    }
}
