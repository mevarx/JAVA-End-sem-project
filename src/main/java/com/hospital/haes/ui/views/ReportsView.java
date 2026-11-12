package com.hospital.haes.ui.views;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.EmergencyEvent;
import com.hospital.haes.ui.AppContext;
import com.hospital.haes.ui.UiUtils;
import com.hospital.haes.util.Result;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBar;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Dialog;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.control.TextArea;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.stage.FileChooser;
import javafx.stage.Window;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.OptionalDouble;

public class ReportsView extends BorderPane implements Refreshable {

    private final AppContext context;
    private final Label appointmentValue = new Label("—");
    private final Label emergencyValue = new Label("—");
    private final Label activeValue = new Label("—");
    private final Label dispatchValue = new Label("—");
    private final Label statusLabel = new Label("Ready");
    private final ListView<EmergencyEvent> recentEvents = new ListView<>();

    public ReportsView(AppContext context) {
        this.context = context;
        setPadding(new Insets(16));
        setTop(buildHeader());
        setCenter(buildContent());
        setBottom(buildActions());
        refresh();
    }

    private VBox buildHeader() {
        Label title = new Label("Reports and evaluation");
        title.getStyleClass().add("section-title");
        Label subtitle = new Label(
                "CSV exports, audit access and measured emergency response indicators from SQLite events.");
        subtitle.getStyleClass().add("muted");
        subtitle.setWrapText(true);
        statusLabel.getStyleClass().add("muted");
        return new VBox(4, title, subtitle, statusLabel);
    }

    private VBox buildContent() {
        HBox metrics = new HBox(10,
                metric("Appointments", appointmentValue),
                metric("Emergency cases", emergencyValue),
                metric("Active emergencies", activeValue),
                metric("Mean dispatch", dispatchValue));
        metrics.setPadding(new Insets(12, 0, 12, 0));

        Label eventsTitle = new Label("Recent lifecycle events");
        eventsTitle.getStyleClass().add("section-title");
        eventsTitle.setStyle("-fx-font-size: 14px;");
        Label eventsHint = new Label("The audit file is append-only; the database keeps the structured event trail.");
        eventsHint.getStyleClass().addAll("muted", "small");
        recentEvents.setPlaceholder(new Label("No emergency events yet."));
        VBox.setVgrow(recentEvents, Priority.ALWAYS);
        VBox box = new VBox(6, metrics, eventsTitle, eventsHint, recentEvents);
        return box;
    }

    private VBox metric(String label, Label value) {
        value.getStyleClass().add("metric-value");
        Label caption = new Label(label);
        caption.getStyleClass().add("metric-label");
        VBox card = new VBox(3, value, caption);
        card.getStyleClass().add("metric-card");
        HBox.setHgrow(card, Priority.ALWAYS);
        return card;
    }

    private VBox buildActions() {
        Button exportAppointments = new Button("Export appointments CSV");
        exportAppointments.getStyleClass().add("primary-button");
        exportAppointments.setOnAction(event -> exportAppointments());

        Button exportEmergencies = new Button("Export emergency CSV");
        exportEmergencies.getStyleClass().add("secondary-button");
        exportEmergencies.setOnAction(event -> exportEmergencies());

        Button importSlots = new Button("Import availability CSV");
        importSlots.getStyleClass().add("secondary-button");
        importSlots.setOnAction(event -> importSlots());

        Button audit = new Button("Open audit log");
        audit.getStyleClass().add("secondary-button");
        audit.setOnAction(event -> showAuditLog());

        Button refresh = new Button("Refresh metrics");
        refresh.getStyleClass().add("secondary-button");
        refresh.setOnAction(event -> refresh());

        FlowPane actions = new FlowPane(10, 8, exportAppointments, exportEmergencies,
                importSlots, audit, refresh);
        actions.setPadding(new Insets(12, 0, 0, 0));
        return new VBox(actions);
    }

    @Override
    public void refresh() {
        try {
            int appointmentCount = context.appointmentService().listAll().size();
            List<EmergencyCase> cases = context.emergencyService().getAllCases();
            List<EmergencyCase> active = context.emergencyService().getActiveCases();
            OptionalDouble average = context.emergencyService().getAverageDispatchMillis();
            appointmentValue.setText(String.valueOf(appointmentCount));
            emergencyValue.setText(String.valueOf(cases.size()));
            activeValue.setText(String.valueOf(active.size()));
            dispatchValue.setText(average.isPresent()
                    ? String.format("%.0f ms", average.getAsDouble()) : "—");
            recentEvents.getItems().setAll(context.emergencyService().getRecentEvents(25));
            statusLabel.setText("SQLite: " + context.databaseManager().getDatabasePath()
                    + " • audit: " + context.auditLog().getLogFile().getFileName()
                    + " • free beds: " + context.emergencyService().getBedPool().availableBeds());
        } catch (DatabaseOperationException e) {
            statusLabel.setText("Could not load metrics: " + e.getMessage());
        }
    }

    private void exportAppointments() {
        FileChooser chooser = new FileChooser();
        chooser.setTitle("Export appointments");
        chooser.getExtensionFilters().add(new FileChooser.ExtensionFilter("CSV files", "*.csv"));
        chooser.setInitialFileName("appointments-" + LocalDate.now() + ".csv");
        java.io.File file = chooser.showSaveDialog(window());
        if (file == null) {
            return;
        }
        Result<Path> result = context.reportingService().exportAppointments(file.toPath());
        if (result.isSuccess()) {
            UiUtils.info(window(), "Export complete", "Saved to " + result.getValue());
        } else {
            UiUtils.error(window(), "Export failed", result.getError());
        }
    }

    private void exportEmergencies() {
        FileChooser chooser = new FileChooser();
        chooser.setTitle("Export emergency report");
        chooser.getExtensionFilters().add(new FileChooser.ExtensionFilter("CSV files", "*.csv"));
        chooser.setInitialFileName("emergencies-" + LocalDate.now() + ".csv");
        java.io.File file = chooser.showSaveDialog(window());
        if (file == null) {
            return;
        }
        Result<Path> result = context.reportingService().exportEmergencies(file.toPath());
        if (result.isSuccess()) {
            UiUtils.info(window(), "Export complete", "Saved to " + result.getValue());
        } else {
            UiUtils.error(window(), "Export failed", result.getError());
        }
    }

    private void importSlots() {
        FileChooser chooser = new FileChooser();
        chooser.setTitle("Import availability");
        chooser.getExtensionFilters().add(new FileChooser.ExtensionFilter("CSV files", "*.csv"));
        chooser.setInitialDirectory(new java.io.File("sample-data").getAbsoluteFile());
        java.io.File file = chooser.showOpenDialog(window());
        if (file == null) {
            return;
        }
        Result<Integer> result = context.reportingService().importSlots(file.toPath());
        if (result.isSuccess()) {
            UiUtils.info(window(), "Import complete", result.getValue() + " slot(s) imported.");
            refresh();
        } else {
            UiUtils.error(window(), "Import finished with errors", result.getError());
        }
    }

    private void showAuditLog() {
        Dialog<ButtonType> dialog = new Dialog<>();
        dialog.initOwner(window());
        dialog.setTitle("Emergency audit log");
        dialog.setHeaderText("Append-only file: " + context.auditLog().getLogFile());
        TextArea area = new TextArea();
        area.setEditable(false);
        area.setPrefSize(760, 440);
        try {
            String content = Files.readString(context.auditLog().getLogFile());
            area.setText(content.isBlank() ? "No emergency audit entries yet." : content);
        } catch (IOException e) {
            area.setText("Could not read the audit log: " + e.getMessage());
        }
        dialog.getDialogPane().setContent(area);
        dialog.getDialogPane().getButtonTypes().add(new ButtonType("Close", ButtonBar.ButtonData.CANCEL_CLOSE));
        dialog.showAndWait();
    }

    private Window window() {
        return getScene() == null ? null : getScene().getWindow();
    }
}
