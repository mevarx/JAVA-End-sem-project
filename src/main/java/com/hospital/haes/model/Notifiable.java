package com.hospital.haes.model;

/**
 * A component that can receive an in-app notification. The UI implements
 * this so background threads never touch JavaFX nodes directly.
 */
public interface Notifiable {

    void receive(Notification notification);
}
