package com.hospital.haes.ui.views;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.Slot;
import com.hospital.haes.ui.AppContext;
import com.hospital.haes.ui.UiUtils;
import javafx.geometry.Insets;
import javafx.scene.control.ButtonBar;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Dialog;
import javafx.scene.control.Label;
import javafx.scene.control.TableRow;
import javafx.scene.control.TableView;
import javafx.stage.Window;

import java.util.List;
import java.util.Optional;

/** Reusable slot chooser for rescheduling and waitlist re-booking. */
public final class SlotPickerDialog {

    private SlotPickerDialog() {
    }

    public static Optional<Slot> show(Window owner, AppContext context, Appointment appointment) {
        Dialog<Slot> dialog = new Dialog<>();
        dialog.initOwner(owner);
        dialog.setTitle("Choose a new slot");
        dialog.setHeaderText("Rebook " + appointment.getPatientName() + " with "
                + appointment.getDoctorName());

        TableView<Slot> table = new TableView<>();
        table.getColumns().add(UiUtils.column("Date", 130, slot -> UiUtils.date(slot.getStart().toLocalDate())));
        table.getColumns().add(UiUtils.column("Time", 120, Slot::getTimeRangeLabel));
        table.getColumns().add(UiUtils.column("Doctor", 200, Slot::getDoctorName));
        table.getColumns().add(UiUtils.column("Department", 160, Slot::getDepartmentName));
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        table.setPrefSize(700, 420);
        table.setPlaceholder(new Label("No free slots are available for this doctor."));

        try {
            List<Slot> slots = context.appointmentService().findAvailableSlots(
                    appointment.getSlot() == null ? null : appointment.getSlot().getDepartmentId(),
                    appointment.getDoctorId(), null);
            table.getItems().setAll(slots);
        } catch (DatabaseOperationException e) {
            UiUtils.error(owner, "Could not load free slots", e);
            return Optional.empty();
        }

        table.setRowFactory(view -> {
            TableRow<Slot> row = new TableRow<>();
            row.setOnMouseClicked(event -> {
                if (event.getClickCount() == 2 && !row.isEmpty()) {
                    table.getSelectionModel().select(row.getItem());
                    dialog.setResult(row.getItem());
                    dialog.close();
                }
            });
            return row;
        });

        Label hint = new Label("Only free slots are shown. The old booking is released in the same transaction.");
        hint.getStyleClass().add("muted");
        hint.setWrapText(true);
        javafx.scene.layout.VBox content = new javafx.scene.layout.VBox(8, hint, table);
        content.setPadding(new Insets(4));
        dialog.getDialogPane().setContent(content);
        dialog.getDialogPane().setPrefWidth(740);

        ButtonType choose = new ButtonType("Use this slot", ButtonBar.ButtonData.OK_DONE);
        dialog.getDialogPane().getButtonTypes().addAll(choose, ButtonType.CANCEL);
        dialog.getDialogPane().lookupButton(choose).disableProperty()
                .bind(table.getSelectionModel().selectedItemProperty().isNull());
        dialog.setResultConverter(button -> button == choose ? table.getSelectionModel().getSelectedItem() : null);
        return dialog.showAndWait();
    }
}
