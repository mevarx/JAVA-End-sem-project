package com.hospital.haes.model;

/**
 * A domain object that can be written to the append-only audit log.
 */
public interface Auditable {

    String toLogLine();
}
