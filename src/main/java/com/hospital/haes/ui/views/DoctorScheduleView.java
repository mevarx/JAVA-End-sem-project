package com.hospital.haes.ui.views;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.InvalidBookingException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.AppointmentStatus;
import com.hospital.haes.model.Role;
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

public class DoctorScheduleView extends BorderPane implements Refreshable {

    private final AppContext context;
    private final User doctor;
    private final TableView<Appointment> table = new TableView<>();
    private final ComboBox<String> statusFilter = new ComboBox<>();
    private final Label statusLabel = new Label("Ready");
    private List<Appointment> allAppointments = new ArrayList<>();

    public DoctorScheduleView(AppContext context, User doctor) {
        this.context = context;
        this.doctor = doctor;
        setPadding(new Insets(16));
        setTop(buildHeader());
        setCenter(buildTable());
        setBottom(buildActions());
        refresh();
    }

    private VBox buildHeader() {
        Label title = new Label("My schedule");
        title.getStyleClass().add("section-title");
        Label subtitle = new Label("Mark consultations completed or no-show. The slot is released for rebooking.");
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
        table.getColumns().add(UiUtils.column("Date", 120,
                appointment -> UiUtils.date(appointment.getStart().toLocalDate())));
        table.getColumns().add(UiUtils.column("Time", 105,
                appointment -> UiUtils.time(appointment.getStart())));
        table.getColumns().add(UiUtils.column("Patient", 180, Appointment::getPatientName));
        table.getColumns().add(UiUtils.column("Department", 150, appointment -> appointment.getSlot() == null
                ? "" : appointment.getSlot().getDepartmentName()));
        table.getColumns().add(UiUtils.column("Reason", 240, Appointment::getReason));
        table.getColumns().add(UiUtils.column("Status", 160, Appointment::getStatusLabel));
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        table.setPlaceholder(new Label("No appointments in your schedule yet."));
        return table;
    }

    private VBox buildActions() {
        Button complete = new Button("Mark completed");
        complete.getStyleClass().add("primary-button");
        complete.setOnAction(event -> updateStatus(AppointmentStatus.COMPLETED));

        Button noShow = new Button("Mark no-show");
        noShow.getStyleClass().add("danger-button");
        noShow.setOnAction(event -> updateStatus(AppointmentStatus.NO_SHOW));

        HBox actions = new HBox(10, complete, noShow);
        actions.setAlignment(Pos.CENTER_LEFT);
        actions.setPadding(new Insets(12, 0, 0, 0));
        return new VBox(actions);
    }

    @Override
    public void refresh() {
        try {
            allAppointments = context.appointmentService().listByDoctor(doctor.getId());
            applyFilter();
        } catch (DatabaseOperationException e) {
            statusLabel.setText("Could not load schedule: " + e.getMessage());
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
        statusLabel.setText(filtered.size() + " appointment(s) in view.");
    }

    private void updateStatus(AppointmentStatus newStatus) {
        Appointment appointment = table.getSelectionModel().getSelectedItem();
        if (appointment == null) {
            UiUtils.warn(window(), "Select an appointment", "Choose an appointment first.");
            return;
        }
        if (appointment.getStatus() != AppointmentStatus.BOOKED) {
            UiUtils.warn(window(), "Not active", "Only active appointments can be updated.");
            return;
        }
        String verb = newStatus == AppointmentStatus.COMPLETED ? "completed" : "marked as no-show";
        if (!UiUtils.confirm(window(), "Update appointment",
                "Mark the appointment with " + appointment.getPatientName() + " on "
                        + UiUtils.dateTime(appointment.getStart()) + " as " + verb + "?")) {
            return;
        }
        try {
            context.appointmentService().changeStatus(appointment.getId(), doctor.getId(),
                    Role.DOCTOR, newStatus);
            refresh();
            statusLabel.setText("Appointment " + verb + ".");
        } catch (InvalidBookingException e) {
            UiUtils.error(window(), "Could not update", e.getMessage());
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
