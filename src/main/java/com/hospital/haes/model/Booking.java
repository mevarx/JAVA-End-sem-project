package com.hospital.haes.model;

import java.time.LocalDateTime;

/**
 * Abstract parent of planned appointments and emergency cases. The two
 * subclasses give {@link #getPriority()} completely different meanings,
 * which is the project's main use of runtime polymorphism.
 */
public abstract class Booking implements Schedulable, Auditable {

    public abstract int getId();

    public abstract LocalDateTime getCreatedAt();

    /** Lower number = handled first. */
    public abstract int getPriority();

    public abstract String getStatusLabel();
}
