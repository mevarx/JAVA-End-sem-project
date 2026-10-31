package com.hospital.haes.model;

import java.util.Locale;

public enum EmergencyType {
    CARDIAC("Cardiac", "cardio"),
    TRAUMA("Trauma", "ortho|trauma|surgery"),
    RESPIRATORY("Respiratory", "pulmo|respir|chest"),
    STROKE("Stroke", "neuro|stroke"),
    OTHER("Other", ".*");

    private final String label;
    private final String specializationPattern;

    EmergencyType(String label, String specializationPattern) {
        this.label = label;
        this.specializationPattern = specializationPattern;
    }

    public String getLabel() {
        return label;
    }

    /**
     * Returns true when a doctor's specialization can handle this emergency.
     * General medicine doctors handle every type; ER staff are matched by role
     * in the service layer, not by this method.
     */
    public boolean matchesSpecialization(String specialization) {
        if (this == OTHER) {
            return true;
        }
        if (specialization == null || specialization.isBlank()) {
            return false;
        }
        String lower = specialization.toLowerCase(Locale.ROOT);
        if (lower.contains("general") || lower.contains("emergency")) {
            return true;
        }
        return lower.matches(".*(" + specializationPattern + ").*");
    }

    @Override
    public String toString() {
        return label;
    }
}
