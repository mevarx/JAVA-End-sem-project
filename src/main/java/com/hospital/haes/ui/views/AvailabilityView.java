package com.hospital.haes.ui.views;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.SlotConflictException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Slot;
import com.hospital.haes.model.SlotStatus;
import com.hospital.haes.model.User;
import com.hospital.haes.ui.AppContext;
import com.hospital.haes.ui.UiUtils;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.DatePicker;
import javafx.scene.control.Label;
import javafx.scene.control.TableView;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Window;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class AvailabilityView extends BorderPane implements Refreshable {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final AppContext context;
    private final User doctor;
    private final TableView<Slot> table = new TableView<>();
    private final DatePicker datePicker = new DatePicker(LocalDate.now().plusDays(1));
    private final ComboBox<String> startTime = new ComboBox<>();
    private final ComboBox<Integer> duration = new ComboBox<>();
    private final Label statusLabel = new Label("Ready");

    public AvailabilityView(AppContext context, User doctor) {
        this.context = context;
        this.doctor = doctor;
        setPadding(new Insets(16));
        setTop(buildHeader());
        setCenter(buildTable());
        setBottom(buildForm());
        refresh();
    }

    private VBox buildHeader() {
        Label title = new Label("My availability");
        title.getStyleClass().add("section-title");
        Label subtitle = new Label("Publish free windows for patients. Overlaps with existing slots are rejected.");
        subtitle.getStyleClass().add("muted");

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

    private TableView<Slot> buildTable() {
        table.getColumns().add(UiUtils.column("Date", 140, slot -> UiUtils.date(slot.getStart().toLocalDate())));
        table.getColumns().add(UiUtils.column("Start", 100, slot -> slot.getStart().format(TIME)));
        table.getColumns().add(UiUtils.column("End", 100, slot -> slot.getEnd().format(TIME)));
        table.getColumns().add(UiUtils.badgeColumn("Status", 120, slot -> slot.getStatus().getLabel(),
                slot -> UiUtils.slotStatusStyle(slot.getStatus())));
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        table.setPlaceholder(new Label("No slots published yet. Add one below."));
        return table;
    }

    private VBox buildForm() {
        for (int hour = 8; hour <= 17; hour++) {
            startTime.getItems().add(String.format("%02d:00", hour));
            startTime.getItems().add(String.format("%02d:30", hour));
        }
        startTime.setValue("09:00");
        startTime.setPrefWidth(100);
        duration.getItems().addAll(15, 30, 45, 60);
        duration.setValue(30);
        duration.setPrefWidth(90);

        Button add = new Button("Publish slot");
        add.getStyleClass().add("primary-button");
        add.setOnAction(event -> addSlot());

        Button delete = new Button("Delete selected free slot");
        delete.getStyleClass().add("danger-button");
        delete.setOnAction(event -> deleteSlot());

        FlowPane form = new FlowPane(10, 8,
                labelled("Date", datePicker), labelled("Start", startTime),
                labelled("Minutes", duration), add, delete);
        form.setPadding(new Insets(12, 0, 0, 0));
        form.setAlignment(Pos.BOTTOM_LEFT);
        return new VBox(form);
    }

    private HBox labelled(String text, javafx.scene.Node control) {
        Label label = new Label(text);
        label.getStyleClass().addAll("small", "muted");
        VBox box = new VBox(4, label, control);
        HBox wrapper = new HBox(box);
        wrapper.setAlignment(Pos.BOTTOM_LEFT);
        return wrapper;
    }

    @Override
    public void refresh() {
        try {
            List<Slot> slots = new ArrayList<>(context.appointmentService().listDoctorSlots(doctor.getId()));
            slots.sort(Comparator.comparing(Slot::getStart));
            table.getItems().setAll(slots);
            statusLabel.setText(slots.size() + " slot(s) on record.");
        } catch (DatabaseOperationException e) {
            statusLabel.setText("Could not load availability: " + e.getMessage());
        }
    }

    private void addSlot() {
        if (datePicker.getValue() == null) {
            UiUtils.error(window(), "Choose a date", "Select the date for the new slot.");
            return;
        }
        String startText = startTime.getValue();
        if (startText == null) {
            UiUtils.error(window(), "Choose a start time", "Select a start time.");
            return;
        }
        LocalTime time = LocalTime.parse(startText, TIME);
        LocalDateTime start = datePicker.getValue().atTime(time);
        int minutes = duration.getValue() == null ? 30 : duration.getValue();
        try {
            Slot slot = context.appointmentService().defineAvailability(
                    doctor.getId(), start, start.plusMinutes(minutes));
            refresh();
            statusLabel.setText("Published slot #" + slot.getId() + " on "
                    + UiUtils.dateTime(slot.getStart()) + ".");
        } catch (ValidationException e) {
            UiUtils.error(window(), "Check the slot", e.getMessage());
        } catch (SlotConflictException e) {
            UiUtils.error(window(), "Slot overlaps", e.getMessage());
        } catch (DatabaseOperationException e) {
            UiUtils.error(window(), "Database error", e);
        }
    }

    private void deleteSlot() {
        Slot slot = table.getSelectionModel().getSelectedItem();
        if (slot == null) {
            UiUtils.warn(window(), "Select a slot", "Choose a slot to delete.");
            return;
        }
        if (slot.getStatus() != SlotStatus.FREE) {
            UiUtils.warn(window(), "Slot is booked", "Booked slots cannot be deleted. Cancel the appointment first.");
            return;
        }
        if (!UiUtils.confirm(window(), "Delete slot",
                "Delete the free slot on " + UiUtils.dateTime(slot.getStart()) + "?")) {
            return;
        }
        try {
            context.appointmentService().removeSlot(slot.getId());
            refresh();
            statusLabel.setText("Slot deleted.");
        } catch (SlotConflictException e) {
            UiUtils.error(window(), "Slot conflict", e.getMessage());
        } catch (ValidationException e) {
            UiUtils.error(window(), "Slot not found", e.getMessage());
        } catch (DatabaseOperationException e) {
            UiUtils.error(window(), "Database error", e);
        }
    }

    private Window window() {
        return getScene() == null ? null : getScene().getWindow();
    }
}
