package com.hospital.haes.ui.views;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.InvalidBookingException;
import com.hospital.haes.exception.SlotConflictException;
import com.hospital.haes.model.Appointment;
import com.hospital.haes.model.Department;
import com.hospital.haes.model.Doctor;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.User;
import com.hospital.haes.ui.AppContext;
import com.hospital.haes.ui.UiUtils;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.DatePicker;
import javafx.scene.control.Label;
import javafx.scene.control.TableRow;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.stage.Window;

import java.time.LocalDate;
import java.util.List;

public class BookAppointmentView extends BorderPane implements Refreshable {

    private final AppContext context;
    private final User actor;
    private final Department allDepartments = new Department(0, "All departments");
    private final Doctor anyDoctor = new Doctor(0, "any", "", "Any doctor",
            null, null, true, "General Medicine", true);

    private final ComboBox<Department> departmentBox = new ComboBox<>();
    private final ComboBox<User> doctorBox = new ComboBox<>();
    private final DatePicker datePicker = new DatePicker(LocalDate.now());
    private final ComboBox<User> patientBox = new ComboBox<>();
    private final TableView<Slot> slotsTable = new TableView<>();
    private final TextField reasonField = new TextField();
    private final Label selectionLabel = new Label("Select a free slot to continue.");
    private final Label statusLabel = new Label("Ready");
    private boolean booking;

    public BookAppointmentView(AppContext context, User actor) {
        this.context = context;
        this.actor = actor;
        setPadding(new Insets(16));
        setTop(buildFilters());
        setCenter(buildTable());
        setBottom(buildBookingBar());
        loadInitialData();
        refresh();
    }

    private VBox buildFilters() {
        Label title = new Label(actor.getRole() == Role.PATIENT
                ? "Find and book an appointment"
                : "Book an appointment for a patient");
        title.getStyleClass().add("section-title");
        Label subtitle = new Label("Free slots only. Overlapping bookings are rejected on the database transaction.");
        subtitle.getStyleClass().add("muted");

        departmentBox.getItems().add(allDepartments);
        try {
            departmentBox.getItems().addAll(context.userService().listDepartments());
        } catch (DatabaseOperationException e) {
            statusLabel.setText("Could not load departments: " + e.getMessage());
        }
        departmentBox.setValue(allDepartments);
        departmentBox.setPrefWidth(190);
        departmentBox.valueProperty().addListener((observable, oldValue, newValue) -> {
            populateDoctors();
            refresh();
        });

        doctorBox.setPrefWidth(220);
        doctorBox.valueProperty().addListener((observable, oldValue, newValue) -> refresh());
        populateDoctors();

        datePicker.setPrefWidth(160);
        datePicker.valueProperty().addListener((observable, oldValue, newValue) -> refresh());

        Button refresh = new Button("Refresh");
        refresh.getStyleClass().add("secondary-button");
        refresh.setOnAction(event -> refresh());

        FlowPane filters = new FlowPane(10, 8,
                labelled("Department", departmentBox),
                labelled("Doctor", doctorBox),
                labelled("Date", datePicker),
                refresh);
        filters.setPadding(new Insets(12, 0, 12, 0));

        statusLabel.getStyleClass().add("muted");
        VBox box = new VBox(4, title, subtitle, filters, statusLabel);
        return box;
    }

    private HBox labelled(String text, javafx.scene.Node control) {
        Label label = new Label(text);
        label.getStyleClass().addAll("small", "muted");
        VBox box = new VBox(4, label, control);
        HBox wrapper = new HBox(box);
        wrapper.setAlignment(Pos.BOTTOM_LEFT);
        return wrapper;
    }

    private VBox buildTable() {
        slotsTable.getColumns().add(UiUtils.column("Date", 130, slot -> UiUtils.date(slot.getStart().toLocalDate())));
        slotsTable.getColumns().add(UiUtils.column("Time", 130, Slot::getTimeRangeLabel));
        slotsTable.getColumns().add(UiUtils.column("Doctor", 220, Slot::getDoctorName));
        slotsTable.getColumns().add(UiUtils.column("Department", 190, Slot::getDepartmentName));
        slotsTable.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        slotsTable.setPlaceholder(new Label("No free slots for the selected filters. Try another date."));
        slotsTable.getSelectionModel().selectedItemProperty().addListener((observable, oldValue, slot) -> {
            if (slot == null) {
                selectionLabel.setText("Select a free slot to continue.");
            } else {
                selectionLabel.setText("Selected: " + slot.getTimeRangeLabel() + " with "
                        + slot.getDoctorName() + " on " + UiUtils.date(slot.getStart().toLocalDate()));
            }
        });
        slotsTable.setRowFactory(table -> {
            TableRow<Slot> row = new TableRow<>();
            row.setOnMouseClicked(event -> {
                if (event.getClickCount() == 2 && !row.isEmpty() && !booking) {
                    book();
                }
            });
            return row;
        });
        VBox.setVgrow(slotsTable, Priority.ALWAYS);
        VBox box = new VBox(8, slotsTable);
        return box;
    }

    private VBox buildBookingBar() {
        selectionLabel.getStyleClass().add("muted");
        reasonField.setPromptText("Reason for visit (required)");
        reasonField.setPrefWidth(420);

        HBox form = new HBox(10);
        form.setAlignment(Pos.CENTER_LEFT);
        if (actor.getRole() != Role.PATIENT) {
            patientBox.setPromptText("Select patient");
            patientBox.setPrefWidth(220);
            form.getChildren().addAll(new Label("Patient"), patientBox);
        }
        form.getChildren().addAll(new Label("Reason"), reasonField);
        HBox.setHgrow(reasonField, Priority.ALWAYS);

        Button book = new Button("Book selected slot");
        book.getStyleClass().add("primary-button");
        book.setOnAction(event -> book());
        form.getChildren().add(book);

        VBox bottom = new VBox(8, selectionLabel, form);
        bottom.setPadding(new Insets(12, 0, 0, 0));
        return bottom;
    }

    private void loadInitialData() {
        if (actor.getRole() != Role.PATIENT) {
            try {
                patientBox.getItems().setAll(context.userService().listPatients());
                if (!patientBox.getItems().isEmpty()) {
                    patientBox.getSelectionModel().selectFirst();
                }
            } catch (DatabaseOperationException e) {
                statusLabel.setText("Could not load patients: " + e.getMessage());
            }
        }
    }

    private void populateDoctors() {
        Doctor selected = doctorBox.getValue() instanceof Doctor doctor ? doctor : anyDoctor;
        doctorBox.getItems().setAll(anyDoctor);
        Department department = departmentBox.getValue();
        Integer departmentId = department == null || department.getId() == 0 ? null : department.getId();
        try {
            List<User> doctors = context.userService().listDoctors();
            for (User doctor : doctors) {
                if (departmentId == null || (doctor.getDepartmentId() != null
                        && doctor.getDepartmentId().equals(departmentId))) {
                    doctorBox.getItems().add(doctor);
                }
            }
        } catch (DatabaseOperationException e) {
            statusLabel.setText("Could not load doctors: " + e.getMessage());
        }
        boolean stillPresent = doctorBox.getItems().stream()
                .anyMatch(user -> user.getId() == selected.getId());
        doctorBox.setValue(stillPresent ? selected : anyDoctor);
    }

    @Override
    public void refresh() {
        if (datePicker.getValue() == null) {
            statusLabel.setText("Choose a date.");
            return;
        }
        Department department = departmentBox.getValue();
        Integer departmentId = department == null || department.getId() == 0 ? null : department.getId();
        Integer doctorId = doctorBox.getValue() == null || doctorBox.getValue().getId() == 0
                ? null : doctorBox.getValue().getId();
        try {
            List<Slot> slots = context.appointmentService()
                    .findAvailableSlots(departmentId, doctorId, datePicker.getValue());
            SlotsTableHelper.setItems(slotsTable, slots);
            statusLabel.setText(slots.size() + " free slot(s) on " + UiUtils.date(datePicker.getValue()) + ".");
        } catch (DatabaseOperationException e) {
            statusLabel.setText("Could not load slots: " + e.getMessage());
        }
    }

    private void book() {
        if (booking) {
            return;
        }
        Slot slot = slotsTable.getSelectionModel().getSelectedItem();
        if (slot == null) {
            UiUtils.warn(window(), "Select a slot", "Choose a free slot from the table first.");
            return;
        }
        Integer patientId;
        if (actor.getRole() == Role.PATIENT) {
            patientId = actor.getId();
        } else {
            User patient = patientBox.getValue();
            if (patient == null) {
                UiUtils.warn(window(), "Select a patient", "Choose the patient this appointment is for.");
                return;
            }
            patientId = patient.getId();
        }
        booking = true;
        try {
            Appointment appointment = context.appointmentService().book(patientId, slot.getId(), reasonField.getText());
            reasonField.clear();
            refresh();
            statusLabel.setText("Appointment #" + appointment.getId() + " booked for "
                    + appointment.getPatientName() + ".");
            UiUtils.info(window(), "Appointment confirmed",
                    appointment.getPatientName() + "\n" + UiUtils.dateTime(appointment.getStart())
                            + " with " + appointment.getDoctorName()
                            + "\n\nA confirmation notification has been added to the panel.");
        } catch (SlotConflictException e) {
            refresh();
            UiUtils.error(window(), "Slot conflict", e.getMessage());
        } catch (InvalidBookingException e) {
            UiUtils.error(window(), "Booking not allowed", e.getMessage());
        } catch (DatabaseOperationException e) {
            UiUtils.error(window(), "Database error", e);
        } finally {
            booking = false;
        }
    }

    private Window window() {
        return getScene() == null ? null : getScene().getWindow();
    }

    /** Keeps the UI class free of a direct dependency on the JavaFX internals. */
    private static final class SlotsTableHelper {
        private static void setItems(TableView<Slot> table, List<Slot> slots) {
            table.getItems().setAll(slots);
        }
    }
}
