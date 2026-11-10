package com.hospital.haes.ui.views;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.InvalidBookingException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.EmergencyEvent;
import com.hospital.haes.model.EmergencyStatus;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.Severity;
import com.hospital.haes.model.User;
import com.hospital.haes.ui.AppContext;
import com.hospital.haes.ui.UiUtils;
import javafx.animation.FadeTransition;
import javafx.animation.KeyFrame;
import javafx.animation.Timeline;
import javafx.geometry.Insets;
import javafx.geometry.Orientation;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.control.SplitPane;
import javafx.scene.control.TableRow;
import javafx.scene.control.TableView;
import javafx.scene.control.TextInputDialog;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Window;
import javafx.util.Duration;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class EmergencyBoardView extends BorderPane implements Refreshable, AutoCloseable {

    public enum Scope {
        PATIENT,
        ASSIGNED,
        ALL
    }

    private final AppContext context;
    private final User actor;
    private final Scope scope;
    private final TableView<EmergencyCase> table = new TableView<>();
    private final ListView<EmergencyEvent> events = new ListView<>();
    private final Label statusLabel = new Label("Ready");
    private final Label bannerLabel = new Label();
    private final HBox banner = new HBox(10);
    private final CheckBox onlyMine = new CheckBox("Only assigned to me");
    private final CheckBox showResolved = new CheckBox("Include resolved");
    private final Timeline autoRefresh;
    private final FadeTransition bannerPulse;
    private boolean loading;
    private boolean tabSelected = true;

    public EmergencyBoardView(AppContext context, User actor, Scope scope) {
        this.context = context;
        this.actor = actor;
        this.scope = scope;
        setPadding(new Insets(16));
        setTop(buildHeader());
        setCenter(buildContent());
        if (scope != Scope.PATIENT) {
            setBottom(buildActions());
        }

        bannerPulse = new FadeTransition(Duration.millis(750), banner);
        bannerPulse.setFromValue(1.0);
        bannerPulse.setToValue(0.55);
        bannerPulse.setAutoReverse(true);
        bannerPulse.setCycleCount(FadeTransition.INDEFINITE);

        autoRefresh = new Timeline(new KeyFrame(Duration.seconds(4), event -> refresh()));
        autoRefresh.setCycleCount(Timeline.INDEFINITE);
        // Only poll while this tab is actually on screen; hidden tabs would otherwise
        // hit SQLite every 4 seconds for nothing.
        sceneProperty().addListener((observable, oldScene, newScene) -> updateAutoRefresh());
        visibleProperty().addListener((observable, oldValue, newValue) -> updateAutoRefresh());

        refresh();
    }

    private VBox buildHeader() {
        Label title = new Label(scope == Scope.PATIENT ? "My emergencies" : "Emergency board");
        title.getStyleClass().add("section-title");
        Label subtitle = new Label(scope == Scope.PATIENT
                ? "Every emergency you raised, with its current status and timestamped timeline."
                : "Priority order is severity first, then arrival time. The dispatcher assigns a responder and bed.");
        subtitle.getStyleClass().add("muted");
        subtitle.setWrapText(true);

        bannerLabel.setWrapText(true);
        banner.getStyleClass().add("critical-banner");
        banner.setAlignment(Pos.CENTER_LEFT);
        banner.getChildren().addAll(new Label("⚠"), bannerLabel);
        banner.setVisible(false);
        banner.setManaged(false);

        HBox filters = new HBox(12);
        filters.setAlignment(Pos.CENTER_LEFT);
        filters.setPadding(new Insets(10, 0, 8, 0));
        if (scope != Scope.PATIENT) {
            if (actor.getRole() == Role.DOCTOR || actor.getRole() == Role.ER_STAFF) {
                onlyMine.setSelected(actor.getRole() == Role.DOCTOR);
                onlyMine.selectedProperty().addListener((observable, oldValue, newValue) -> refresh());
                filters.getChildren().add(onlyMine);
            }
            if (actor.getRole() != Role.ER_STAFF) {
                showResolved.selectedProperty().addListener((observable, oldValue, newValue) -> refresh());
                filters.getChildren().add(showResolved);
            }
        }
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        Button refresh = new Button("Refresh");
        refresh.getStyleClass().add("secondary-button");
        refresh.setOnAction(event -> refresh());
        filters.getChildren().addAll(spacer, refresh);

        statusLabel.getStyleClass().add("muted");
        return new VBox(4, title, subtitle, banner, filters, statusLabel);
    }

    private SplitPane buildContent() {
        table.getColumns().add(UiUtils.column("ID", 52, c -> "#" + c.getId()));
        table.getColumns().add(UiUtils.badgeColumn("Severity", 95, c -> c.getSeverity().getLabel(),
                c -> UiUtils.severityStyle(c.getSeverity())));
        table.getColumns().add(UiUtils.column("Type", 102, c -> c.getType().getLabel()));
        table.getColumns().add(UiUtils.column("Location", 125, EmergencyCase::getLocation));
        table.getColumns().add(UiUtils.column("Patient", 145, EmergencyCase::getPatientLabel));
        table.getColumns().add(UiUtils.badgeColumn("Status", 175, EmergencyCase::getStatusLabel,
                c -> UiUtils.emergencyStatusStyle(c.getStatus())));
        table.getColumns().add(UiUtils.column("Assigned to", 160, c ->
                c.getAssignedToName() == null ? "—" : c.getAssignedToName()));
        table.getColumns().add(UiUtils.column("Bed", 50, c -> c.getBedNo() == null ? "—" : String.valueOf(c.getBedNo())));
        table.getColumns().add(UiUtils.column("Raised", 130, c -> UiUtils.dateTime(c.getRaisedAt())));
        table.getColumns().add(UiUtils.column("Waited", 70, this::waited));
        table.getColumns().add(UiUtils.column("Esc.", 50, c -> String.valueOf(c.getEscalationCount())));
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        table.setPlaceholder(new Label("No emergency cases to show."));
        table.setRowFactory(view -> {
            TableRow<EmergencyCase> row = new TableRow<>();
            row.itemProperty().addListener((observable, oldValue, emergencyCase) -> {
                row.getStyleClass().removeAll("critical-row", "waiting-row", "assigned-row");
                if (emergencyCase != null) {
                    if (emergencyCase.getSeverity() == Severity.CRITICAL) {
                        row.getStyleClass().add("critical-row");
                    } else if (emergencyCase.getStatus() == EmergencyStatus.WAITING) {
                        row.getStyleClass().add("waiting-row");
                    } else if (emergencyCase.getStatus().isActive()) {
                        row.getStyleClass().add("assigned-row");
                    }
                }
            });
            return row;
        });
        table.getSelectionModel().selectedItemProperty().addListener((observable, oldValue, selected) -> {
            if (!loading) {
                loadEvents(selected);
            }
        });

        Label timelineTitle = new Label("Case timeline");
        timelineTitle.getStyleClass().add("section-title");
        timelineTitle.setStyle("-fx-font-size: 14px;");
        Label timelineHint = new Label("Every lifecycle event is timestamped in SQLite and the append-only audit file.");
        timelineHint.getStyleClass().addAll("muted", "small");
        events.setPlaceholder(new Label("Select a case to inspect its lifecycle events."));
        VBox timeline = new VBox(4, timelineTitle, timelineHint, events);
        VBox.setVgrow(events, Priority.ALWAYS);

        SplitPane split = new SplitPane(table, timeline);
        split.setOrientation(Orientation.VERTICAL);
        split.setDividerPositions(0.64);
        return split;
    }

    private VBox buildActions() {
        Button acknowledge = new Button("Acknowledge selected");
        acknowledge.getStyleClass().add("primary-button");
        acknowledge.setOnAction(event -> acknowledge());

        Button resolve = new Button("Resolve selected");
        resolve.getStyleClass().add("secondary-button");
        resolve.setOnAction(event -> resolve());

        Button dispatch = new Button("Dispatch now");
        dispatch.getStyleClass().add("secondary-button");
        dispatch.setOnAction(event -> dispatchNow());

        HBox row = new HBox(10, acknowledge, resolve, dispatch);
        row.setAlignment(Pos.CENTER_LEFT);
        row.setPadding(new Insets(10, 0, 0, 0));
        return new VBox(row);
    }

    @Override
    public void refresh() {
        List<EmergencyCase> base;
        try {
            if (scope == Scope.PATIENT) {
                base = context.emergencyService().findByPatient(actor.getId());
            } else if (showResolved.isSelected()) {
                base = context.emergencyService().getAllCases();
            } else {
                base = context.emergencyService().getActiveCases();
            }
        } catch (DatabaseOperationException e) {
            statusLabel.setText("Could not load emergencies: " + e.getMessage());
            return;
        }
        updateBanner(base);

        List<EmergencyCase> visible = new ArrayList<>();
        for (EmergencyCase emergencyCase : base) {
            if (onlyMine.isSelected()) {
                if (emergencyCase.getAssignedTo() == null
                        || emergencyCase.getAssignedTo() != actor.getId()) {
                    continue;
                }
            }
            visible.add(emergencyCase);
        }
        if (scope == Scope.PATIENT) {
            visible.sort((a, b) -> b.getRaisedAt().compareTo(a.getRaisedAt()));
        }

        Integer selectedId = table.getSelectionModel().getSelectedItem() == null
                ? null : table.getSelectionModel().getSelectedItem().getId();
        loading = true;
        table.getItems().setAll(visible);
        loading = false;
        statusLabel.setText(visible.size() + " case(s) in view • dispatcher queue: "
                + context.emergencyService().getQueueSize());

        if (selectedId != null) {
            for (EmergencyCase emergencyCase : visible) {
                if (emergencyCase.getId() == selectedId) {
                    table.getSelectionModel().select(emergencyCase);
                    loadEvents(emergencyCase);
                    break;
                }
            }
        } else if (!visible.isEmpty() && scope != Scope.PATIENT) {
            table.getSelectionModel().selectFirst();
            loadEvents(table.getSelectionModel().getSelectedItem());
        } else {
            loadEvents(table.getSelectionModel().getSelectedItem());
        }
    }

    private void updateBanner(List<EmergencyCase> cases) {
        EmergencyCase critical = cases.stream()
                .filter(c -> c.getSeverity() == Severity.CRITICAL
                        && c.getStatus() != EmergencyStatus.RESOLVED)
                .findFirst().orElse(null);
        if (critical == null) {
            banner.setVisible(false);
            banner.setManaged(false);
            bannerPulse.stop();
            return;
        }
        bannerLabel.setText("CRITICAL #" + critical.getId() + " " + critical.getType()
                + " at " + critical.getLocation() + " • " + critical.getStatus().getLabel());
        banner.setVisible(true);
        banner.setManaged(true);
        bannerPulse.play();
    }

    private String waited(EmergencyCase emergencyCase) {
        if (emergencyCase.getResolvedAt() != null) {
            return "—";
        }
        long minutes = ChronoUnit.MINUTES.between(emergencyCase.getRaisedAt(), LocalDateTime.now());
        return Math.max(0, minutes) + "m";
    }

    private void loadEvents(EmergencyCase emergencyCase) {
        if (emergencyCase == null) {
            events.getItems().clear();
            return;
        }
        try {
            events.getItems().setAll(context.emergencyService().getEvents(emergencyCase.getId()));
        } catch (DatabaseOperationException e) {
            statusLabel.setText("Could not load event timeline: " + e.getMessage());
        }
    }

    private void acknowledge() {
        EmergencyCase selected = table.getSelectionModel().getSelectedItem();
        if (selected == null) {
            UiUtils.warn(window(), "Select a case", "Choose an emergency to acknowledge.");
            return;
        }
        try {
            context.emergencyService().acknowledge(selected.getId(), actor.getId());
            refresh();
            statusLabel.setText("Emergency #" + selected.getId() + " acknowledged. Escalation cancelled.");
        } catch (InvalidBookingException e) {
            UiUtils.error(window(), "Could not acknowledge", e.getMessage());
        } catch (UnauthorizedActionException e) {
            UiUtils.error(window(), "Not assigned to you", e.getMessage());
        } catch (DatabaseOperationException e) {
            UiUtils.error(window(), "Database error", e);
        }
    }

    private void resolve() {
        EmergencyCase selected = table.getSelectionModel().getSelectedItem();
        if (selected == null) {
            UiUtils.warn(window(), "Select a case", "Choose an emergency to resolve.");
            return;
        }
        TextInputDialog input = new TextInputDialog("Case resolved");
        input.initOwner(window());
        input.setTitle("Resolve emergency #" + selected.getId());
        input.setHeaderText("Resolution note");
        input.setContentText("Outcome:");
        Optional<String> note = input.showAndWait();
        if (note.isEmpty()) {
            return;
        }
        try {
            context.emergencyService().resolve(selected.getId(), actor.getId(), actor.getRole(), note.get());
            refresh();
            statusLabel.setText("Emergency #" + selected.getId() + " resolved and bed released.");
        } catch (InvalidBookingException e) {
            UiUtils.error(window(), "Could not resolve", e.getMessage());
        } catch (UnauthorizedActionException e) {
            UiUtils.error(window(), "Not allowed", e.getMessage());
        } catch (DatabaseOperationException e) {
            UiUtils.error(window(), "Database error", e);
        }
    }

    private void dispatchNow() {
        try {
            int count = context.emergencyService().dispatchPendingNow();
            refresh();
            statusLabel.setText("Dispatch pass complete • " + count + " case(s) assigned.");
        } catch (RuntimeException e) {
            UiUtils.error(window(), "Dispatch failed", e);
        }
    }

    private void updateAutoRefresh() {
        boolean onScreen = getScene() != null && isVisible() && tabSelected;
        if (onScreen) {
            if (autoRefresh.getStatus() != javafx.animation.Animation.Status.RUNNING) {
                autoRefresh.play();
                refresh();
            }
        } else {
            autoRefresh.stop();
            bannerPulse.stop();
        }
    }

    /** Called by MainWindow when the tab holding this view is selected or deselected. */
    public void setTabSelected(boolean selected) {
        this.tabSelected = selected;
        updateAutoRefresh();
    }

    private Window window() {
        return getScene() == null ? null : getScene().getWindow();
    }

    @Override
    public void close() {
        autoRefresh.stop();
        bannerPulse.stop();
    }
}
