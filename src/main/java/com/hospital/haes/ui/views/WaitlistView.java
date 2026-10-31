package com.hospital.haes.ui.views;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.InvalidBookingException;
import com.hospital.haes.exception.SlotConflictException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.User;
import com.hospital.haes.ui.AppContext;
import com.hospital.haes.ui.UiUtils;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TableView;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Window;

import java.util.List;
import java.util.Optional;

/**
 * Patients whose routine appointment was pre-empted by a Critical emergency
 * are collected here by the PriorityScheduler-based waitlist (FR-13/FR-6).
 */
public class WaitlistView extends BorderPane implements Refreshable {

    private final AppContext context;
    private final User actor;
    private final TableView<Appointment> table = new TableView<>();
    private final Label statusLabel = new Label("Ready");

    public WaitlistView(AppContext context, User actor) {
        this.context = context;
        this.actor = actor;
        setPadding(new Insets(16));
        setTop(buildHeader());
        setCenter(buildTable());
        setBottom(buildActions());
        refresh();
    }

    private VBox buildHeader() {
        Label title = new Label("Re-booking queue");
        title.getStyleClass().add("section-title");
        Label subtitle = new Label(
                "Appointments displaced by a Critical emergency. The waitlist is ordered by the generic PriorityScheduler.");
        subtitle.getStyleClass().add("muted");
        subtitle.setWrapText(true);

        Button refresh = new Button("Refresh");
        refresh.getStyleClass().add("secondary-button");
        refresh.setOnAction(event -> refresh());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox toolbar = new HBox(10, spacer, refresh);
        toolbar.setAlignment(Pos.CENTER_RIGHT);
        toolbar.setPadding(new Insets(12, 0, 10, 0));
        statusLabel.getStyleClass().add("muted");
        return new VBox(4, title, subtitle, toolbar, statusLabel);
    }

    private TableView<Appointment> buildTable() {
        table.getColumns().add(UiUtils.column("Patient", 170, Appointment::getPatientName));
        table.getColumns().add(UiUtils.column("Doctor", 180, Appointment::getDoctorName));
        table.getColumns().add(UiUtils.column("Original date", 130,
                appointment -> UiUtils.date(appointment.getStart().toLocalDate())));
        table.getColumns().add(UiUtils.column("Original time", 110,
                appointment -> UiUtils.time(appointment.getStart())));
        table.getColumns().add(UiUtils.column("Reason", 240, Appointment::getReason));
        table.getColumns().add(UiUtils.column("Status", 160, Appointment::getStatusLabel));
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        table.setPlaceholder(new Label("No pre-empted appointments. Routine bookings are intact."));
        return table;
    }

    private VBox buildActions() {
        Button rebook = new Button("Re-book selected patient");
        rebook.getStyleClass().add("primary-button");
        rebook.setOnAction(event -> rebook());
        HBox actions = new HBox(10, rebook);
        actions.setAlignment(Pos.CENTER_LEFT);
        actions.setPadding(new Insets(12, 0, 0, 0));
        return new VBox(actions);
    }

    @Override
    public void refresh() {
        try {
            context.appointmentService().refreshWaitlist();
            List<Appointment> waitlist = context.appointmentService().getWaitlistSnapshot();
            table.getItems().setAll(waitlist);
            statusLabel.setText(waitlist.size() + " patient(s) waiting for a new slot.");
        } catch (DatabaseOperationException e) {
            statusLabel.setText("Could not load the waitlist: " + e.getMessage());
        }
    }

    private void rebook() {
        Appointment appointment = table.getSelectionModel().getSelectedItem();
        if (appointment == null) {
            UiUtils.warn(window(), "Select a patient", "Choose a waitlisted appointment first.");
            return;
        }
        Optional<Slot> slot = SlotPickerDialog.show(window(), context, appointment);
        if (slot.isEmpty()) {
            return;
        }
        try {
            Appointment replacement = context.appointmentService().reschedule(
                    appointment.getId(), slot.get().getId(), actor.getId(), actor.getRole());
            refresh();
            statusLabel.setText("Patient re-booked for " + UiUtils.dateTime(replacement.getStart()) + ".");
        } catch (SlotConflictException e) {
            refresh();
            UiUtils.error(window(), "Slot conflict", e.getMessage());
        } catch (InvalidBookingException e) {
            UiUtils.error(window(), "Could not rebook", e.getMessage());
        } catch (UnauthorizedActionException e) {
            UiUtils.error(window(), "Not allowed", e.getMessage());
        } catch (DatabaseOperationException e) {
            UiUtils.error(window(), "Database error", e);
        }
    }

    private Window window() {
        return getScene() == null ? null : getScene().getWindow();
    }
}
