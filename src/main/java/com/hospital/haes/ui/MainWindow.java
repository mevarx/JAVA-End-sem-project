package com.hospital.haes.ui;

import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.Notification;
import com.hospital.haes.model.NotificationLevel;
import com.hospital.haes.model.Notifiable;
import com.hospital.haes.model.User;
import com.hospital.haes.ui.views.AdminDepartmentsView;
import com.hospital.haes.ui.views.AdminUsersView;
import com.hospital.haes.ui.views.AllAppointmentsView;
import com.hospital.haes.ui.views.AvailabilityView;
import com.hospital.haes.ui.views.BookAppointmentView;
import com.hospital.haes.ui.views.DoctorScheduleView;
import com.hospital.haes.ui.views.EmergencyBoardView;
import com.hospital.haes.ui.views.MyAppointmentsView;
import com.hospital.haes.ui.views.Refreshable;
import com.hospital.haes.ui.views.ReportsView;
import com.hospital.haes.ui.views.WaitlistView;
import com.hospital.haes.util.Result;
import javafx.animation.KeyFrame;
import javafx.animation.ScaleTransition;
import javafx.animation.Timeline;
import javafx.application.Platform;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBar;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Dialog;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.Menu;
import javafx.scene.control.MenuBar;
import javafx.scene.control.MenuItem;
import javafx.scene.control.SeparatorMenuItem;
import javafx.scene.control.Tab;
import javafx.scene.control.TabPane;
import javafx.scene.control.TextArea;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.FileChooser;
import javafx.stage.Window;
import javafx.util.Duration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Role-aware application shell. Tabs are chosen from the signed-in role and
 * all data changes go through services; this class only handles presentation
 * and event wiring.
 */
public class MainWindow extends BorderPane implements Notifiable {

    private final AppContext context;
    private final User user;
    private final Runnable onLogout;
    private final TabPane tabPane = new TabPane();
    private final ObservableList<Notification> notifications = FXCollections.observableArrayList();
    private final ListView<Notification> notificationList = new ListView<>(notifications);
    private final Label statusLabel = new Label("Ready");
    private final Label unreadLabel = new Label();
    private final List<Refreshable> refreshables = new ArrayList<>();
    private ScaleTransition emergencyPulse;
    private Timeline liveStatus;
    private int unreadCount;

    public MainWindow(AppContext context, User user, Runnable onLogout) {
        this.context = context;
        this.user = user;
        this.onLogout = onLogout;

        context.notificationService().addListener(this);

        setTop(buildTop());
        setCenter(buildCenter());
        setRight(buildNotificationPanel());
        setBottom(buildStatusBar());
        loadNotificationHistory();
        // Keep the status bar honest about the live dispatch queue and free beds.
        liveStatus = new Timeline(new KeyFrame(Duration.seconds(5), event -> updateLiveStatus()));
        liveStatus.setCycleCount(Timeline.INDEFINITE);
        liveStatus.play();

        tabPane.getSelectionModel().selectedItemProperty().addListener((observable, oldTab, newTab) -> {
            if (oldTab != null && oldTab.getContent() instanceof EmergencyBoardView oldBoard) {
                oldBoard.setTabSelected(false);
            }
            if (newTab != null) {
                if (newTab.getContent() instanceof EmergencyBoardView newBoard) {
                    newBoard.setTabSelected(true);
                }
                if (newTab.getContent() instanceof Refreshable refreshable) {
                    refreshable.refresh();
                }
            }
        });
        setPadding(Insets.EMPTY);
    }

    private Node buildTop() {
        VBox top = new VBox();

        MenuBar menuBar = new MenuBar();
        Menu file = new Menu("File");
        MenuItem exportAppointments = new MenuItem("Export appointments to CSV…");
        exportAppointments.setOnAction(event -> exportAppointments());
        MenuItem exportEmergencies = new MenuItem("Export emergency report to CSV…");
        exportEmergencies.setOnAction(event -> exportEmergencies());
        MenuItem importSlots = new MenuItem("Import availability from CSV…");
        importSlots.setOnAction(event -> importSlots());
        MenuItem audit = new MenuItem("Show emergency audit log");
        audit.setOnAction(event -> showAuditLog());
        MenuItem logout = new MenuItem("Log out");
        logout.setOnAction(event -> logout());
        MenuItem exit = new MenuItem("Exit");
        exit.setOnAction(event -> Platform.exit());
        file.getItems().addAll(exportAppointments, exportEmergencies, importSlots,
                new SeparatorMenuItem(), audit, new SeparatorMenuItem(), logout, exit);

        Menu help = new Menu("Help");
        MenuItem about = new MenuItem("About HAES");
        about.setOnAction(event -> showAbout());
        MenuItem demo = new MenuItem("Demo flow");
        demo.setOnAction(event -> showDemoHelp());
        help.getItems().addAll(about, demo);
        menuBar.getMenus().addAll(file, help);

        Label brand = new Label("HAES");
        brand.getStyleClass().add("app-name");
        Label subtitle = new Label("Hospital Appointment & Emergency Centre");
        subtitle.setStyle("-fx-text-fill: #94a3b8; -fx-font-size: 11px;");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        Label signedIn = new Label("Signed in as " + user.getFullName());
        signedIn.setStyle("-fx-text-fill: #e2e8f0; -fx-font-size: 12px;");
        Label role = new Label(user.getRole().getLabel());
        role.getStyleClass().add("role-chip");

        Button emergencyButton = new Button("⚠  EMERGENCY");
        emergencyButton.getStyleClass().add("emergency-button");
        emergencyButton.setTooltip(new javafx.scene.control.Tooltip(
                "Raise an emergency case (Ctrl+E)"));
        emergencyButton.setOnAction(event -> openEmergencyDialog());
        // Keyboard shortcut so the red button is reachable without the mouse.
        javafx.scene.input.KeyCombination raiseEmergency =
                javafx.scene.input.KeyCombination.keyCombination("Shortcut+E");
        sceneProperty().addListener((observable, oldScene, newScene) -> {
            if (oldScene != null) {
                oldScene.getAccelerators().remove(raiseEmergency);
            }
            if (newScene != null) {
                newScene.getAccelerators().put(raiseEmergency, emergencyButton::fire);
            }
        });
        emergencyPulse = new ScaleTransition(Duration.millis(850), emergencyButton);
        emergencyPulse.setFromX(1.0);
        emergencyPulse.setFromY(1.0);
        emergencyPulse.setToX(1.04);
        emergencyPulse.setToY(1.04);
        emergencyPulse.setAutoReverse(true);
        emergencyPulse.setCycleCount(ScaleTransition.INDEFINITE);
        emergencyPulse.play();

        HBox header = new HBox(12, brand, subtitle, spacer, signedIn, role, emergencyButton);
        header.setAlignment(Pos.CENTER_LEFT);
        header.getStyleClass().add("app-header");

        top.getChildren().addAll(menuBar, header);
        return top;
    }

    private Node buildCenter() {
        tabPane.setTabClosingPolicy(TabPane.TabClosingPolicy.UNAVAILABLE);
        addRoleTabs();
        BorderPane center = new BorderPane(tabPane);
        center.getStyleClass().add("content-pane");
        BorderPane.setMargin(tabPane, new Insets(0));
        return center;
    }

    private void addRoleTabs() {
        switch (user.getRole()) {
            case PATIENT -> {
                addTab("Book appointment", new BookAppointmentView(context, user));
                addTab("My appointments", new MyAppointmentsView(context, user));
                addTab("My emergencies", new EmergencyBoardView(context, user,
                        EmergencyBoardView.Scope.PATIENT));
            }
            case DOCTOR -> {
                addTab("My schedule", new DoctorScheduleView(context, user));
                addTab("Availability", new AvailabilityView(context, user));
                addTab("Emergencies", new EmergencyBoardView(context, user,
                        EmergencyBoardView.Scope.ASSIGNED));
            }
            case RECEPTIONIST -> {
                addTab("Book for patient", new BookAppointmentView(context, user));
                addTab("All appointments", new AllAppointmentsView(context, user));
                addTab("Re-book queue", new WaitlistView(context, user));
                addTab("Emergency board", new EmergencyBoardView(context, user,
                        EmergencyBoardView.Scope.ALL));
            }
            case ER_STAFF -> {
                addTab("Emergency board", new EmergencyBoardView(context, user,
                        EmergencyBoardView.Scope.ALL));
                addTab("All appointments", new AllAppointmentsView(context, user));
            }
            case ADMIN -> {
                addTab("Users", new AdminUsersView(context, user));
                addTab("Departments", new AdminDepartmentsView(context));
                addTab("Appointments", new AllAppointmentsView(context, user));
                addTab("Re-book queue", new WaitlistView(context, user));
                addTab("Emergency board", new EmergencyBoardView(context, user,
                        EmergencyBoardView.Scope.ALL));
                addTab("Reports", new ReportsView(context));
            }
        }
        if (tabPane.getTabs().isEmpty()) {
            tabPane.getTabs().add(new Tab("No workspace",
                    new Label("No screen is configured for role " + user.getRole())));
        }
    }

    private void addTab(String title, Node content) {
        Tab tab = new Tab(title, content);
        tab.setClosable(false);
        if (content instanceof EmergencyBoardView board) {
            // Background boards only poll while their tab is selected.
            board.setTabSelected(tabPane.getTabs().isEmpty());
        }
        tabPane.getTabs().add(tab);
        if (content instanceof Refreshable refreshable) {
            refreshables.add(refreshable);
        }
    }

    private Node buildNotificationPanel() {
        VBox panel = new VBox(8);
        panel.getStyleClass().add("notification-panel");
        panel.setPrefWidth(300);
        panel.setMinWidth(260);

        Label title = new Label("Notifications");
        title.getStyleClass().add("title");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        unreadLabel.getStyleClass().add("role-chip");
        unreadLabel.setVisible(false);
        unreadLabel.setManaged(false);
        Button clear = new Button("Clear");
        clear.getStyleClass().add("secondary-button");
        clear.setStyle("-fx-font-size: 10px; -fx-padding: 3 8 3 8;");
        clear.setOnAction(event -> {
            // Clear only this session's panel. The history deque is shared by every
            // signed-in user, so wiping it here would empty other users' panels too.
            notifications.clear();
            unreadCount = 0;
            unreadLabel.setVisible(false);
            unreadLabel.setManaged(false);
            statusLabel.setText("Notifications cleared for this session.");
        });
        HBox header = new HBox(6, title, spacer, unreadLabel, clear);
        header.setAlignment(Pos.CENTER_LEFT);

        Label hint = new Label("Live appointment and emergency events");
        hint.getStyleClass().addAll("muted", "small");
        hint.setWrapText(true);

        notificationList.getStyleClass().add("notification-list");
        notificationList.setCellFactory(list -> new NotificationCell());
        VBox.setVgrow(notificationList, Priority.ALWAYS);

        panel.getChildren().addAll(header, hint, notificationList);
        return panel;
    }

    private Node buildStatusBar() {
        statusLabel.getStyleClass().add("muted");
        Label db = new Label("DB: " + context.databaseManager().getDatabasePath().getFileName());
        db.getStyleClass().addAll("muted", "small");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox bar = new HBox(10, statusLabel, spacer, db);
        bar.setAlignment(Pos.CENTER_LEFT);
        bar.setPadding(new Insets(6, 14, 6, 14));
        bar.setStyle("-fx-background-color: #ffffff; -fx-border-color: #e2e8f0; -fx-border-width: 1 0 0 0;");
        return bar;
    }

    private void loadNotificationHistory() {
        notifications.setAll(context.notificationService().getHistoryFor(user.getId()));
    }

    @Override
    public void receive(Notification notification) {
        if (notification.getTargetUserId() != 0 && notification.getTargetUserId() != user.getId()) {
            return;
        }
        // receive() is called from dispatcher/escalation threads, so every UI touch,
        // including the unread badge, must be marshalled onto the FX thread.
        UiUtils.runOnFx(() -> {
            notifications.add(0, notification);
            while (notifications.size() > 100) {
                notifications.remove(notifications.size() - 1);
            }
            unreadCount++;
            unreadLabel.setText(String.valueOf(unreadCount));
            unreadLabel.setVisible(true);
            unreadLabel.setManaged(true);
            statusLabel.setText("Live • " + notification.getMessage());
            refreshEmergencyViews();
            refreshAppointmentViews();
        });
    }

    private void updateLiveStatus() {
        try {
            int queued = context.emergencyService().getQueueSize();
            int beds = context.emergencyService().getBedPool().availableBeds();
            statusLabel.setText("Dispatcher queue: " + queued + " • free ER beds: " + beds);
        } catch (RuntimeException e) {
            statusLabel.setText("Live status unavailable: " + e.getMessage());
        }
    }

    private void refreshEmergencyViews() {
        for (Tab tab : tabPane.getTabs()) {
            if (tab.getContent() instanceof EmergencyBoardView board) {
                board.refresh();
            }
        }
    }

    /** Appointment views are not on a timer, so live events (e.g. pre-emption) must refresh them. */
    private void refreshAppointmentViews() {
        for (Tab tab : tabPane.getTabs()) {
            Node content = tab.getContent();
            if (content instanceof MyAppointmentsView || content instanceof AllAppointmentsView
                    || content instanceof DoctorScheduleView || content instanceof WaitlistView) {
                try {
                    ((Refreshable) content).refresh();
                } catch (RuntimeException e) {
                    System.err.println("Appointment view refresh failed: " + e.getMessage());
                }
            }
        }
    }

    private void openEmergencyDialog() {
        EmergencyDialog dialog = new EmergencyDialog(context, user, window());
        Optional<EmergencyCase> result = dialog.showAndWait();
        result.ifPresent(emergencyCase -> {
            refreshEmergencyViews();
            UiUtils.info(window(), "Emergency #" + emergencyCase.getId() + " raised",
                    "The case is in the priority queue. Severity: " + emergencyCase.getSeverity()
                            + ", type: " + emergencyCase.getType() + ".\n"
                            + "A responder and bed will be assigned by the dispatcher.");
        });
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
            UiUtils.info(window(), "Export complete", "Appointments saved to:\n" + result.getValue());
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
            UiUtils.info(window(), "Export complete", "Emergency report saved to:\n" + result.getValue());
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
            UiUtils.info(window(), "Import complete",
                    result.getValue() + " slot(s) imported. Open the relevant schedule to see them.");
            refreshAll();
        } else {
            UiUtils.error(window(), "Import finished with errors", result.getError());
            refreshAll();
        }
    }

    private void showAuditLog() {
        Dialog<ButtonType> dialog = new Dialog<>();
        dialog.initOwner(window());
        dialog.setTitle("Emergency audit log");
        dialog.setHeaderText("Append-only file: " + context.auditLog().getLogFile());
        TextArea area = new TextArea();
        area.setEditable(false);
        area.setWrapText(false);
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

    private void showAbout() {
        UiUtils.info(window(), "HAES • CSE 213",
                "Hospital Appointment and Emergency Scheduler\n\n"
                        + "JavaFX + SQLite + JDBC, with a priority dispatcher, escalation timer,\n"
                        + "per-slot locks and a limited ER bed pool.\n\n"
                        + "Academic simulation with invented sample data. Not a clinical system.");
    }

    private void showDemoHelp() {
        UiUtils.info(window(), "Suggested demo flow",
                "1. As patient.anita, book an appointment and note the confirmation notification.\n"
                        + "2. Switch to dr.sharma and add an availability slot.\n"
                        + "3. Raise a Critical Cardiac emergency using the red button.\n"
                        + "4. Watch the emergency board as the dispatcher assigns a doctor and bed.\n"
                        + "5. Acknowledge and resolve the case. Unacknowledged cases escalate after 30s.\n"
                        + "6. As admin, export both CSV reports and inspect the audit log.");
    }

    private void logout() {
        if (!UiUtils.confirm(window(), "Log out", "Sign out of " + user.getFullName() + "?")) {
            return;
        }
        dispose();
        onLogout.run();
    }

    private Window window() {
        return getScene() == null ? null : getScene().getWindow();
    }

    private void refreshAll() {
        for (Refreshable refreshable : refreshables) {
            try {
                refreshable.refresh();
            } catch (RuntimeException e) {
                System.err.println("Refresh failed: " + e.getMessage());
            }
        }
    }

    public void dispose() {
        context.notificationService().removeListener(this);
        if (emergencyPulse != null) {
            emergencyPulse.stop();
        }
        if (liveStatus != null) {
            liveStatus.stop();
        }
        for (Tab tab : tabPane.getTabs()) {
            if (tab.getContent() instanceof AutoCloseable closeable) {
                try {
                    closeable.close();
                } catch (Exception ignored) {
                    // Closing a view must never prevent logout.
                }
            }
        }
    }

    private static final class NotificationCell extends ListCell<Notification> {

        @Override
        protected void updateItem(Notification notification, boolean empty) {
            super.updateItem(notification, empty);
            if (empty || notification == null) {
                setText(null);
                setGraphic(null);
                return;
            }
            Label time = new Label(notification.getTimeLabel());
            time.getStyleClass().addAll("muted", "small");
            Label message = new Label(notification.getMessage());
            message.setWrapText(true);
            message.setMaxWidth(250);
            message.getStyleClass().add(styleFor(notification.getLevel()));
            VBox box = new VBox(3, time, message);
            box.setFillWidth(true);
            setText(null);
            setGraphic(box);
        }

        private String styleFor(NotificationLevel level) {
            return switch (level) {
                case CRITICAL -> "notif-critical";
                case WARNING -> "notif-warning";
                case SUCCESS -> "notif-success";
                case INFO -> "notif-info";
            };
        }
    }
}
