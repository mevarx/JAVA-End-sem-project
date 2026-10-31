package com.hospital.haes.model;

public enum Severity {
    CRITICAL("Critical", 0),
    HIGH("High", 1),
    MEDIUM("Medium", 2);

    private final String label;
    private final int rank;

    Severity(String label, int rank) {
        this.label = label;
        this.rank = rank;
    }

    public String getLabel() {
        return label;
    }

    /** Lower rank = more urgent; used by the emergency priority queue. */
    public int getRank() {
        return rank;
    }

    @Override
    public String toString() {
        return label;
    }
}
