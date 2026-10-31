package com.hospital.haes;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.model.User;
import com.hospital.haes.ui.AppContext;
import com.hospital.haes.ui.LoginView;
import com.hospital.haes.ui.MainWindow;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.stage.Stage;

import java.nio.file.Path;
import java.util.Objects;

public class Main extends Application {

    private AppContext context;
    private Stage stage;

    @Override
    public void start(Stage primaryStage) {
        this.stage = primaryStage;
        primaryStage.setTitle("Hospital Appointment & Emergency Scheduler");
        primaryStage.setMinWidth(1120);
        primaryStage.setMinHeight(700);
        try {
            Path database = Path.of(System.getProperty("haes.db", "haes.db"));
            Path audit = Path.of(System.getProperty("haes.audit", "emergency_audit.log"));
            context = AppContext.bootstrap(database, audit);
            context.emergencyService().start();
        } catch (DatabaseOperationException e) {
            Alert alert = new Alert(Alert.AlertType.ERROR);
            alert.setTitle("HAES could not start");
            alert.setHeaderText("Database problem");
            alert.setContentText("The application could not open or initialize its SQLite database.\n\n"
                    + e.getMessage()
                    + "\n\nCheck that the folder is writable, then restart.");
            alert.showAndWait();
            Platform.exit();
            return;
        } catch (RuntimeException e) {
            Alert alert = new Alert(Alert.AlertType.ERROR);
            alert.setTitle("HAES could not start");
            alert.setHeaderText("Unexpected startup error");
            alert.setContentText(String.valueOf(e.getMessage()));
            alert.showAndWait();
            Platform.exit();
            return;
        }
        showLogin();
    }

    private void showLogin() {
        LoginView loginView = new LoginView(context, this::showMainWindow);
        Scene scene = new Scene(loginView, 1180, 780);
        applyStyles(scene);
        stage.setTitle("HAES • Sign in");
        stage.setScene(scene);
        stage.show();
    }

    private void showMainWindow(User user) {
        MainWindow mainWindow = new MainWindow(context, user, this::showLogin);
        Scene scene = new Scene(mainWindow, 1380, 840);
        applyStyles(scene);
        stage.setTitle("HAES • " + user.getFullName() + " • " + user.getRole().getLabel());
        stage.setScene(scene);
        stage.show();
    }

    private void applyStyles(Scene scene) {
        try {
            scene.getStylesheets().add(Objects.requireNonNull(
                    Main.class.getResource("/css/app.css")).toExternalForm());
        } catch (RuntimeException e) {
            System.err.println("Could not load stylesheet: " + e.getMessage());
        }
    }

    @Override
    public void stop() {
        if (context != null) {
            context.shutdown();
        }
    }

    public static void main(String[] args) {
        launch(args);
    }
}
