package com.hospital.haes.ui;

import com.hospital.haes.model.AppointmentStatus;
import com.hospital.haes.model.EmergencyStatus;
import com.hospital.haes.model.Severity;
import com.hospital.haes.model.SlotStatus;
import javafx.application.Platform;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.scene.control.Alert;
import javafx.scene.control.ButtonType;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.stage.Window;

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

    /**
     * Table column whose cells render a coloured pill instead of plain text, so severity
     * and status are readable at a glance. The pill style class is resolved per value.
     */
    public static <T> TableColumn<T, String> badgeColumn(String title, double width,
                                                         Function<T, String> text,
                                                         Function<T, String> styleClass) {
        TableColumn<T, String> column = new TableColumn<>(title);
        column.setPrefWidth(width);
        column.setCellValueFactory(cell -> {
            String value;
            try {
                value = text.apply(cell.getValue());
            } catch (RuntimeException e) {
                value = "";
            }
            return new ReadOnlyStringWrapper(value == null ? "" : value);
        });
        column.setCellFactory(col -> new TableCell<>() {
            @Override
            protected void updateItem(String value, boolean empty) {
                super.updateItem(value, empty);
                getStyleClass().removeIf(style -> style.startsWith("badge-"));
                if (empty || value == null || value.isBlank()) {
                    setText(null);
                    setGraphic(null);
                    return;
                }
                T row = getTableRow() == null ? null : getTableRow().getItem();
                setText(value);
                String style = "badge";
                if (row != null) {
                    try {
                        String extra = styleClass.apply(row);
                        if (extra != null) {
                            style = extra;
                        }
                    } catch (RuntimeException ignored) {
                        // Fall back to the neutral badge.
                    }
                }
                getStyleClass().add(style);
            }
        });
        return column;
    }

    /** Severity pill style for an emergency case. */
    public static String severityStyle(Severity severity) {
        return switch (severity) {
            case CRITICAL -> "badge-critical";
            case HIGH -> "badge-high";
            case MEDIUM -> "badge-medium";
        };
    }

    /** Status pill style for an emergency case. */
    public static String emergencyStatusStyle(EmergencyStatus status) {
        return switch (status) {
            case WAITING -> "badge-waiting";
            case ASSIGNED, ACKNOWLEDGED -> "badge-assigned";
            case ESCALATED -> "badge-escalated";
            case RESOLVED -> "badge-resolved";
        };
    }

    /** Status pill style for an appointment. */
    public static String appointmentStatusStyle(AppointmentStatus status) {
        return switch (status) {
            case BOOKED -> "badge-assigned";
            case COMPLETED -> "badge-resolved";
            case CANCELLED, NO_SHOW -> "badge-neutral";
            case RESCHEDULED -> "badge-medium";
            case PRE_EMPTED -> "badge-critical";
        };
    }

    /** Slot pill style. */
    public static String slotStatusStyle(SlotStatus status) {
        return status == SlotStatus.FREE ? "badge-resolved" : "badge-assigned";
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

    public static void runOnFx(Runnable runnable) {
        if (Platform.isFxApplicationThread()) {
            runnable.run();
        } else {
            Platform.runLater(runnable);
        }
    }
}
