package com.hospital.haes.ui;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.User;
import javafx.event.ActionEvent;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBar;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Dialog;
import javafx.scene.control.Label;
import javafx.scene.control.PasswordField;
import javafx.scene.control.Separator;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

import java.util.function.Consumer;

public class LoginView extends StackPane {

    private final AppContext context;
    private final Consumer<User> onLogin;
    private final TextField usernameField = new TextField();
    private final PasswordField passwordField = new PasswordField();
    private final Label errorLabel = new Label();
    private final Button signInButton = new Button("Sign in");

    public LoginView(AppContext context, Consumer<User> onLogin) {
        this.context = context;
        this.onLogin = onLogin;
        getStyleClass().add("login-root");
        setPadding(new Insets(24));
        setAlignment(Pos.CENTER);

        VBox card = new VBox(14);
        card.getStyleClass().add("login-card");
        card.setAlignment(Pos.TOP_LEFT);

        Label eyebrow = new Label("CSE 213  •  INTEGRATED JAVA PROJECT");
        eyebrow.getStyleClass().add("eyebrow");

        Label title = new Label("Hospital Appointment & Emergency Scheduler");
        title.getStyleClass().add("brand-title");
        title.setWrapText(true);

        Label subtitle = new Label(
                "Book outpatient appointments and dispatch emergency cases from one desktop workspace.");
        subtitle.getStyleClass().add("brand-subtitle");
        subtitle.setWrapText(true);

        usernameField.setPromptText("Username");
        passwordField.setPromptText("Password");
        usernameField.setOnAction(event -> signIn());
        passwordField.setOnAction(event -> signIn());

        signInButton.getStyleClass().add("primary-button");
        signInButton.setMaxWidth(Double.MAX_VALUE);
        signInButton.setDefaultButton(true);
        signInButton.setOnAction(event -> signIn());

        Button registerButton = new Button("Create a patient account");
        registerButton.getStyleClass().add("secondary-button");
        registerButton.setMaxWidth(Double.MAX_VALUE);
        registerButton.setOnAction(event -> showRegisterDialog());

        errorLabel.getStyleClass().add("error-label");
        errorLabel.setWrapText(true);
        errorLabel.setVisible(false);
        errorLabel.setManaged(false);

        VBox fields = new VBox(8, new Label("Username"), usernameField,
                new Label("Password"), passwordField, errorLabel, signInButton);
        fields.setPadding(new Insets(8, 0, 0, 0));

        Separator separator = new Separator();

        VBox demo = new VBox(6);
        demo.getStyleClass().add("demo-box");
        Label demoTitle = new Label("Demo accounts (sample data)");
        demoTitle.getStyleClass().add("eyebrow");
        demo.getChildren().add(demoTitle);
        demo.getChildren().add(demoRow("Admin", "admin", "admin123"));
        demo.getChildren().add(demoRow("Reception", "reception", "reception123"));
        demo.getChildren().add(demoRow("Doctor", "dr.sharma", "doctor123"));
        demo.getChildren().add(demoRow("ER staff", "er.patel", "er123"));
        demo.getChildren().add(demoRow("Patient", "patient.anita", "patient123"));

        Label footnote = new Label("Academic simulation • invented data only • not for clinical use");
        footnote.getStyleClass().addAll("muted", "small");
        footnote.setWrapText(true);

        card.getChildren().addAll(eyebrow, title, subtitle, fields, registerButton,
                separator, demo, footnote);
        getChildren().add(card);
    }

    private HBox demoRow(String role, String username, String password) {
        Label roleLabel = new Label(role);
        roleLabel.setMinWidth(76);
        roleLabel.getStyleClass().add("muted");
        Label credentials = new Label(username + " / " + password);
        credentials.getStyleClass().add("demo-key");
        HBox.setHgrow(credentials, Priority.ALWAYS);
        HBox row = new HBox(8, roleLabel, credentials);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private void signIn() {
        errorLabel.setVisible(false);
        errorLabel.setManaged(false);
        signInButton.setDisable(true);
        try {
            User user = context.authService().login(usernameField.getText(), passwordField.getText());
            onLogin.accept(user);
        } catch (UnauthorizedActionException e) {
            showError(e.getMessage());
        } catch (DatabaseOperationException e) {
            showError("Database error: " + e.getMessage());
        } catch (RuntimeException e) {
            showError("Could not sign in: " + e.getMessage());
        } finally {
            signInButton.setDisable(false);
        }
    }

    private void showError(String message) {
        errorLabel.setText(message);
        errorLabel.setVisible(true);
        errorLabel.setManaged(true);
        passwordField.clear();
        passwordField.requestFocus();
    }

    private void showRegisterDialog() {
        Dialog<ButtonType> dialog = new Dialog<>();
        dialog.initOwner(getScene() == null ? null : getScene().getWindow());
        dialog.setTitle("Create patient account");
        dialog.setHeaderText("New patient registration");

        TextField username = new TextField();
        PasswordField password = new PasswordField();
        TextField fullName = new TextField();
        TextField phone = new TextField();
        GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(10);
        grid.setPadding(new Insets(10));
        grid.addRow(0, new Label("Username"), username);
        grid.addRow(1, new Label("Password"), password);
        grid.addRow(2, new Label("Full name"), fullName);
        grid.addRow(3, new Label("Phone (optional)"), phone);
        dialog.getDialogPane().setContent(grid);

        ButtonType create = new ButtonType("Create account", ButtonBar.ButtonData.OK_DONE);
        dialog.getDialogPane().getButtonTypes().addAll(create, ButtonType.CANCEL);
        dialog.getDialogPane().lookupButton(create).addEventFilter(ActionEvent.ACTION, event -> {
            try {
                context.authService().registerPatient(username.getText(), password.getText(),
                        fullName.getText(), phone.getText());
                Alert alert = new Alert(Alert.AlertType.INFORMATION);
                alert.setTitle("HAES");
                alert.setHeaderText("Account created");
                alert.setContentText("You can now sign in with your new patient account.");
                alert.showAndWait();
            } catch (ValidationException e) {
                UiUtils.error(dialog.getDialogPane().getScene().getWindow(), "Check your details", e.getMessage());
                event.consume();
            } catch (DatabaseOperationException e) {
                UiUtils.error(dialog.getDialogPane().getScene().getWindow(), "Registration failed", e);
                event.consume();
            }
        });
        dialog.showAndWait();
    }
}
