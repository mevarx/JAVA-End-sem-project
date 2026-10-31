package com.hospital.haes.ui;

import com.hospital.haes.model.Notification;
import javafx.application.Platform;
import javafx.event.Event;
import javafx.event.EventType;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.scene.control.Alert;
import javafx.scene.control.ButtonType;
import javafx.scene.control.TableColumn;
import javafx.stage.Window;

import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.function.Function;

/** Small JavaFX helpers shared by every view. */
public final class UiUtils {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private UiUtils() {
    }

    public static String dateTime(LocalDateTime value) {
        return value == null ? "" : value.format(DATE_TIME);
    }

    public static String date(LocalDate value) {
        return value == null ? "" : value.format(DATE);
    }

    public static String time(LocalDateTime value) {
        return value == null ? "" : value.format(TIME);
    }

    public static <T> TableColumn<T, String> column(String title, double width,
                                                    Function<T, String> accessor) {
        TableColumn<T, String> column = new TableColumn<>(title);
        column.setPrefWidth(width);
        column.setCellValueFactory(cell -> {
            String value;
            try {
                value = accessor.apply(cell.getValue());
            } catch (RuntimeException e) {
                value = "";
            }
            return new ReadOnlyStringWrapper(value == null ? "" : value);
        });
        return column;
    }

    public static void error(Window owner, String header, Throwable throwable) {
        String message = throwable == null || throwable.getMessage() == null
                ? "An unexpected error occurred." : throwable.getMessage();
        Alert alert = new Alert(Alert.AlertType.ERROR);
        alert.initOwner(owner);
        alert.setTitle("HAES");
        alert.setHeaderText(header);
        alert.setContentText(message);
        alert.showAndWait();
    }

    public static void error(Window owner, String header, String message) {
        Alert alert = new Alert(Alert.AlertType.ERROR);
        alert.initOwner(owner);
        alert.setTitle("HAES");
        alert.setHeaderText(header);
        alert.setContentText(message);
        alert.showAndWait();
    }

    public static void info(Window owner, String header, String message) {
        Alert alert = new Alert(Alert.AlertType.INFORMATION);
        alert.initOwner(owner);
        alert.setTitle("HAES");
        alert.setHeaderText(header);
        alert.setContentText(message);
        alert.showAndWait();
    }

    public static void warn(Window owner, String header, String message) {
        Alert alert = new Alert(Alert.AlertType.WARNING);
        alert.initOwner(owner);
        alert.setTitle("HAES");
        alert.setHeaderText(header);
        alert.setContentText(message);
        alert.showAndWait();
    }

    public static boolean confirm(Window owner, String header, String message) {
        Alert alert = new Alert(Alert.AlertType.CONFIRMATION);
        alert.initOwner(owner);
        alert.setTitle("HAES");
        alert.setHeaderText(header);
        alert.setContentText(message);
        Optional<ButtonType> result = alert.showAndWait();
        return result.isPresent() && result.get() == ButtonType.OK;
    }

    public static String fileName(Path path) {
        return path == null ? "" : path.getFileName().toString();
    }

    /** Custom JavaFX event used by the notification panel to update visual state. */
    public static final class NotificationEvent extends Event {

        public static final EventType<NotificationEvent> NOTIFICATION =
                new EventType<>(Event.ANY, "HAES_NOTIFICATION");

        private final transient Notification notification;

        public NotificationEvent(Notification notification) {
            super(NOTIFICATION);
            this.notification = notification;
        }

        public Notification getNotification() {
            return notification;
        }
    }

    public static void runOnFx(Runnable runnable) {
        if (Platform.isFxApplicationThread()) {
            runnable.run();
        } else {
            Platform.runLater(runnable);
        }
    }
}
