package com.hospital.haes.ui.views;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.InvalidBookingException;
import com.hospital.haes.exception.SlotConflictException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.AppointmentStatus;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.User;
import com.hospital.haes.ui.AppContext;
import com.hospital.haes.ui.UiUtils;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TableView;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Window;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class MyAppointmentsView extends BorderPane implements Refreshable {

    private final AppContext context;
    private final User actor;
    private final TableView<Appointment> table = new TableView<>();
    private final ComboBox<String> statusFilter = new ComboBox<>();
    private final Label statusLabel = new Label("Ready");
    private List<Appointment> allAppointments = new ArrayList<>();

    public MyAppointmentsView(AppContext context, User actor) {
        this.context = context;
        this.actor = actor;
        setPadding(new Insets(16));
        setTop(buildHeader());
        setCenter(buildTable());
        setBottom(buildActions());
        refresh();
    }

    private VBox buildHeader() {
        Label title = new Label("My appointments");
        title.getStyleClass().add("section-title");
        Label subtitle = new Label("Cancel or move an active booking. Pre-empted bookings can be re-booked here.");
        subtitle.getStyleClass().add("muted");

        statusFilter.getItems().add("All statuses");
        for (AppointmentStatus status : AppointmentStatus.values()) {
            statusFilter.getItems().add(status.getLabel());
        }
        statusFilter.setValue("All statuses");
        statusFilter.setPrefWidth(190);
        statusFilter.valueProperty().addListener((observable, oldValue, newValue) -> applyFilter());

        Button refresh = new Button("Refresh");
        refresh.getStyleClass().add("secondary-button");
        refresh.setOnAction(event -> refresh());

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox toolbar = new HBox(10, statusFilter, spacer, refresh);
        toolbar.setAlignment(Pos.CENTER_LEFT);
        toolbar.setPadding(new Insets(12, 0, 10, 0));

        statusLabel.getStyleClass().add("muted");
        return new VBox(4, title, subtitle, toolbar, statusLabel);
    }

    private TableView<Appointment> buildTable() {
        table.getColumns().add(UiUtils.column("Date", 120, appointment -> UiUtils.date(appointment.getStart().toLocalDate())));
        table.getColumns().add(UiUtils.column("Time", 105, appointment -> UiUtils.time(appointment.getStart())));
        table.getColumns().add(UiUtils.column("Doctor", 180, Appointment::getDoctorName));
        table.getColumns().add(UiUtils.column("Department", 150, appointment -> appointment.getSlot() == null
                ? "" : appointment.getSlot().getDepartmentName()));
        table.getColumns().add(UiUtils.column("Reason", 230, Appointment::getReason));
        table.getColumns().add(UiUtils.badgeColumn("Status", 160, Appointment::getStatusLabel,
                appointment -> UiUtils.appointmentStatusStyle(appointment.getStatus())));
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        table.setPlaceholder(new Label("You have no appointments yet. Use the Book tab to find a slot."));
        return table;
    }

    private VBox buildActions() {
        Button reschedule = new Button("Reschedule / rebook");
        reschedule.getStyleClass().add("primary-button");
        reschedule.setOnAction(event -> reschedule());

        Button cancel = new Button("Cancel appointment");
        cancel.getStyleClass().add("danger-button");
        cancel.setOnAction(event -> cancel());

        HBox actions = new HBox(10, reschedule, cancel);
        actions.setAlignment(Pos.CENTER_LEFT);
        actions.setPadding(new Insets(12, 0, 0, 0));
        return new VBox(actions);
    }

    @Override
    public void refresh() {
        try {
            allAppointments = context.appointmentService().listByPatient(actor.getId());
            applyFilter();
        } catch (DatabaseOperationException e) {
            statusLabel.setText("Could not load appointments: " + e.getMessage());
        }
    }

    private void applyFilter() {
        String filter = statusFilter.getValue();
        List<Appointment> filtered = new ArrayList<>();
        for (Appointment appointment : allAppointments) {
            if (filter == null || filter.equals("All statuses")
                    || appointment.getStatus().getLabel().equals(filter)) {
                filtered.add(appointment);
            }
        }
        table.getItems().setAll(filtered);
        statusLabel.setText(filtered.size() + " appointment(s) shown.");
    }

    private void reschedule() {
        Appointment appointment = table.getSelectionModel().getSelectedItem();
        if (appointment == null) {
            UiUtils.warn(window(), "Select an appointment", "Choose the appointment you want to move.");
            return;
        }
        if (appointment.getStatus() != AppointmentStatus.BOOKED
                && appointment.getStatus() != AppointmentStatus.PRE_EMPTED) {
            UiUtils.warn(window(), "Not rebookable", "Only active or pre-empted appointments can be moved.");
            return;
        }
        Optional<Slot> slot = SlotPickerDialog.show(window(), context, appointment);
        if (slot.isEmpty()) {
            return;
        }
        try {
            Appointment replacement = context.appointmentService()
                    .reschedule(appointment.getId(), slot.get().getId(), actor.getId(), Role.PATIENT);
            refresh();
            statusLabel.setText("Appointment moved to " + UiUtils.dateTime(replacement.getStart()) + ".");
        } catch (SlotConflictException e) {
            refresh();
            UiUtils.error(window(), "New slot no longer free", e.getMessage());
        } catch (InvalidBookingException e) {
            UiUtils.error(window(), "Could not reschedule", e.getMessage());
        } catch (UnauthorizedActionException e) {
            UiUtils.error(window(), "Not allowed", e.getMessage());
        } catch (DatabaseOperationException e) {
            UiUtils.error(window(), "Database error", e);
        }
    }

    private void cancel() {
        Appointment appointment = table.getSelectionModel().getSelectedItem();
        if (appointment == null) {
            UiUtils.warn(window(), "Select an appointment", "Choose the appointment you want to cancel.");
            return;
        }
        if (!UiUtils.confirm(window(), "Cancel appointment",
                "Cancel " + appointment.getDoctorName() + " on "
                        + UiUtils.dateTime(appointment.getStart()) + "?")) {
            return;
        }
        try {
            context.appointmentService().cancel(appointment.getId(), actor.getId(), Role.PATIENT);
            refresh();
            statusLabel.setText("Appointment cancelled and the slot released.");
        } catch (InvalidBookingException e) {
            UiUtils.error(window(), "Could not cancel", e.getMessage());
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
