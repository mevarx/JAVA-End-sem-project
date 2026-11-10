package com.hospital.haes.ui;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.EmergencyCase;
import com.hospital.haes.model.EmergencyType;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.Severity;
import com.hospital.haes.model.User;
import javafx.event.ActionEvent;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBar;
import javafx.scene.control.ButtonType;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Dialog;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.stage.Window;

import java.util.List;

/**
 * Fast emergency intake. All fields have safe defaults so a user can press
 * the red button and submit in three clicks or fewer (FR-15).
 */
public class EmergencyDialog extends Dialog<EmergencyCase> {

    public EmergencyDialog(AppContext context, User actor, Window owner) {
        initOwner(owner);
        setTitle("Raise emergency");
        setHeaderText("Emergency intake");

        ComboBox<EmergencyType> type = new ComboBox<>();
        type.getItems().setAll(EmergencyType.values());
        type.setValue(EmergencyType.CARDIAC);

        ComboBox<Severity> severity = new ComboBox<>();
        severity.getItems().setAll(Severity.values());
        severity.setValue(Severity.HIGH);

        TextField location = new TextField("ER Gate");
        location.setPromptText("Gate, ward or bed");

        ComboBox<User> patientCombo = new ComboBox<>();
        TextField walkInLabel = new TextField("Walk-in 01");
        if (actor.getRole() != Role.PATIENT) {
            try {
                List<User> patients = context.userService().listPatients();
                patientCombo.getItems().setAll(patients);
                patientCombo.setPromptText("Walk-in / unregistered (optional)");
            } catch (DatabaseOperationException e) {
                // Keep the failure visible; silently showing an empty list would look
                // like the hospital has no registered patients.
                patientCombo.setPromptText("Could not load patients — use walk-in");
                patientCombo.setDisable(true);
            }
            patientCombo.setPrefWidth(260);
            walkInLabel.setPrefWidth(260);
        }

        GridPane grid = new GridPane();
        grid.setHgap(12);
        grid.setVgap(10);
        grid.setPadding(new Insets(8, 4, 4, 4));

        int row = 0;
        grid.addRow(row++, new Label("Type"), type);
        grid.addRow(row++, new Label("Severity"), severity);
        grid.addRow(row++, new Label("Location"), location);
        if (actor.getRole() != Role.PATIENT) {
            HBox existing = new HBox(8, patientCombo);
            grid.addRow(row++, new Label("Existing patient"), existing);
            Button clearPatient = new Button("Walk-in");
            clearPatient.getStyleClass().add("secondary-button");
            clearPatient.setOnAction(event -> {
                patientCombo.setValue(null);
                walkInLabel.requestFocus();
            });
            existing.getChildren().add(clearPatient);
            grid.addRow(row++, new Label("Walk-in label"), walkInLabel);
        }

        Label hint = new Label(
                "The case enters the priority queue immediately. A Critical case may pre-empt a routine appointment.");
        hint.setWrapText(true);
        hint.getStyleClass().add("muted");

        VBox content = new VBox(8, grid, hint);
        content.setPadding(new Insets(4, 8, 8, 8));
        getDialogPane().setContent(content);
        getDialogPane().setPrefWidth(480);

        ButtonType submit = new ButtonType("Raise emergency", ButtonBar.ButtonData.OK_DONE);
        getDialogPane().getButtonTypes().addAll(submit, ButtonType.CANCEL);
        Button submitButton = (Button) getDialogPane().lookupButton(submit);
        submitButton.getStyleClass().add("emergency-button");
        submitButton.addEventFilter(ActionEvent.ACTION, event -> {
            try {
                Integer patientId;
                String label;
                if (actor.getRole() == Role.PATIENT) {
                    patientId = actor.getId();
                    label = actor.getFullName();
                } else if (patientCombo.getValue() != null) {
                    patientId = patientCombo.getValue().getId();
                    label = patientCombo.getValue().getFullName();
                } else {
                    patientId = null;
                    label = walkInLabel.getText();
                }
                EmergencyCase emergencyCase = context.emergencyService().raiseEmergency(
                        patientId, label, type.getValue(), severity.getValue(),
                        location.getText(), actor.getId());
                setResult(emergencyCase);
            } catch (ValidationException e) {
                UiUtils.error(getDialogPane().getScene().getWindow(), "Check the emergency details", e.getMessage());
                event.consume();
            } catch (DatabaseOperationException e) {
                UiUtils.error(getDialogPane().getScene().getWindow(), "Could not raise emergency", e);
                event.consume();
            }
        });
    }
}
