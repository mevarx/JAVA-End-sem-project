package com.hospital.haes.ui.views;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Department;
import com.hospital.haes.model.Doctor;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.User;
import com.hospital.haes.ui.AppContext;
import com.hospital.haes.ui.UiUtils;
import javafx.event.ActionEvent;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBar;
import javafx.scene.control.ButtonType;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Dialog;
import javafx.scene.control.Label;
import javafx.scene.control.PasswordField;
import javafx.scene.control.TableRow;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Window;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class AdminUsersView extends BorderPane implements Refreshable {

    private final AppContext context;
    private final User actor;
    private final TableView<User> table = new TableView<>();
    private final Label statusLabel = new Label("Ready");
    private final Map<Integer, String> departmentNames = new HashMap<>();
    private List<Department> departments;
    private boolean userDialogOpen;

    public AdminUsersView(AppContext context, User actor) {
        this.context = context;
        this.actor = actor;
        setPadding(new Insets(16));
        setTop(buildHeader());
        setCenter(buildTable());
        setBottom(buildActions());
        refresh();
    }

    private VBox buildHeader() {
        Label title = new Label("Users");
        title.getStyleClass().add("section-title");
        Label subtitle = new Label("Create and manage patients, doctors, front-desk staff, ER staff and admins.");
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

    private TableView<User> buildTable() {
        table.getColumns().add(UiUtils.column("ID", 55, user -> String.valueOf(user.getId())));
        table.getColumns().add(UiUtils.column("Username", 150, User::getUsername));
        table.getColumns().add(UiUtils.column("Role", 110, user -> user.getRole().getLabel()));
        table.getColumns().add(UiUtils.column("Full name", 190, User::getFullName));
        table.getColumns().add(UiUtils.column("Phone", 130, User::getPhone));
        table.getColumns().add(UiUtils.column("Department", 160, user -> user.getDepartmentId() == null
                ? "—" : departmentNames.getOrDefault(user.getDepartmentId(), "—")));
        table.getColumns().add(UiUtils.column("Specialization", 170, user -> user.getSpecialization() == null
                ? "—" : user.getSpecialization()));
        table.getColumns().add(UiUtils.column("On call", 80, user -> user instanceof Doctor doctor
                ? (doctor.isOnCall() ? "Yes" : "No") : "—"));
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        table.setPlaceholder(new Label("No users found."));
        table.setRowFactory(view -> {
            TableRow<User> row = new TableRow<>();
            row.setOnMouseClicked(event -> {
                if (event.getClickCount() == 2 && !row.isEmpty()) {
                    showUserDialog(row.getItem());
                }
            });
            return row;
        });
        return table;
    }

    private VBox buildActions() {
        Button add = new Button("Add user");
        add.getStyleClass().add("primary-button");
        add.setOnAction(event -> showUserDialog(null));

        Button edit = new Button("Edit user");
        edit.getStyleClass().add("secondary-button");
        edit.setOnAction(event -> {
            User selected = table.getSelectionModel().getSelectedItem();
            if (selected == null) {
                UiUtils.warn(window(), "Select a user", "Choose a user to edit.");
            } else {
                showUserDialog(selected);
            }
        });

        Button delete = new Button("Delete user");
        delete.getStyleClass().add("danger-button");
        delete.setOnAction(event -> deleteUser());

        HBox actions = new HBox(10, add, edit, delete);
        actions.setAlignment(Pos.CENTER_LEFT);
        actions.setPadding(new Insets(12, 0, 0, 0));
        return new VBox(actions);
    }

    @Override
    public void refresh() {
        try {
            departments = context.departmentService().listAll();
            departmentNames.clear();
            for (Department department : departments) {
                departmentNames.put(department.getId(), department.getName());
            }
            List<User> users = context.userService().listAll();
            table.getItems().setAll(users);
            statusLabel.setText(users.size() + " user account(s).");
        } catch (DatabaseOperationException e) {
            statusLabel.setText("Could not load users: " + e.getMessage());
        }
    }

    private void showUserDialog(User existing) {
        if (userDialogOpen) {
            return;
        }
        userDialogOpen = true;
        try {
            showUserDialogInternal(existing);
        } finally {
            userDialogOpen = false;
        }
    }

    private void showUserDialogInternal(User existing) {
        if (departments == null) {
            refresh();
        }
        if (departments == null) {
            // Without the department list an edit would silently clear the user's department.
            UiUtils.error(window(), "Departments unavailable",
                    "The department list could not be loaded. Try again before editing users.");
            return;
        }
        Dialog<ButtonType> dialog = new Dialog<>();
        dialog.initOwner(window());
        dialog.setTitle(existing == null ? "Add user" : "Edit user");
        dialog.setHeaderText(existing == null ? "Create an account" : "Edit " + existing.getFullName());

        TextField username = new TextField(existing == null ? "" : existing.getUsername());
        PasswordField password = new PasswordField();
        TextField fullName = new TextField(existing == null ? "" : existing.getFullName());
        TextField phone = new TextField(existing == null || existing.getPhone() == null ? "" : existing.getPhone());
        ComboBox<Role> role = new ComboBox<>();
        role.getItems().setAll(Role.values());
        role.setValue(existing == null ? Role.PATIENT : existing.getRole());

        ComboBox<Department> department = new ComboBox<>();
        Department none = new Department(0, "No department");
        department.getItems().add(none);
        if (departments != null) {
            department.getItems().addAll(departments);
        }
        Department selectedDepartment = none;
        if (existing != null && existing.getDepartmentId() != null && departments != null) {
            for (Department candidate : departments) {
                if (candidate.getId() == existing.getDepartmentId()) {
                    selectedDepartment = candidate;
                    break;
                }
            }
        }
        department.setValue(selectedDepartment);

        TextField specialization = new TextField(existing == null || existing.getSpecialization() == null
                ? "" : existing.getSpecialization());
        CheckBox onCall = new CheckBox("Available for emergency dispatch");
        onCall.setSelected(!(existing instanceof Doctor doctor) || doctor.isOnCall());

        Runnable updateDoctorFields = () -> {
            boolean doctorRole = role.getValue() == Role.DOCTOR;
            specialization.setDisable(!doctorRole);
            onCall.setDisable(!doctorRole);
        };
        role.valueProperty().addListener((observable, oldValue, newValue) -> updateDoctorFields.run());
        updateDoctorFields.run();

        Label passwordHint = new Label(existing == null
                ? "At least 6 characters."
                : "Leave blank to keep the current password.");
        passwordHint.getStyleClass().addAll("muted", "small");

        GridPane grid = new GridPane();
        grid.setHgap(12);
        grid.setVgap(9);
        grid.setPadding(new Insets(8));
        int row = 0;
        grid.addRow(row++, new Label("Username"), username);
        grid.addRow(row++, new Label("Password"), password);
        grid.add(passwordHint, 1, row++);
        grid.addRow(row++, new Label("Full name"), fullName);
        grid.addRow(row++, new Label("Phone"), phone);
        grid.addRow(row++, new Label("Role"), role);
        grid.addRow(row++, new Label("Department"), department);
        grid.addRow(row++, new Label("Specialization"), specialization);
        grid.add(onCall, 1, row);
        dialog.getDialogPane().setContent(grid);
        dialog.getDialogPane().setPrefWidth(480);

        ButtonType save = new ButtonType("Save", ButtonBar.ButtonData.OK_DONE);
        dialog.getDialogPane().getButtonTypes().addAll(save, ButtonType.CANCEL);
        boolean[] saved = {false};
        dialog.getDialogPane().lookupButton(save).addEventFilter(ActionEvent.ACTION, event -> {
            Integer departmentId = department.getValue() == null || department.getValue().getId() == 0
                    ? null : department.getValue().getId();
            try {
                if (existing == null) {
                    context.userService().createUser(username.getText(), password.getText(),
                            role.getValue(), fullName.getText(), phone.getText(), departmentId,
                            specialization.getText(), onCall.isSelected());
                } else {
                    context.userService().updateUser(existing.getId(), username.getText(),
                            password.getText(), role.getValue(), fullName.getText(), phone.getText(),
                            departmentId, specialization.getText(), onCall.isSelected());
                }
                saved[0] = true;
            } catch (ValidationException e) {
                UiUtils.error(dialog.getDialogPane().getScene().getWindow(), "Check the account", e.getMessage());
                event.consume();
            } catch (DatabaseOperationException e) {
                UiUtils.error(dialog.getDialogPane().getScene().getWindow(), "Could not save the user", e);
                event.consume();
            }
        });
        dialog.showAndWait();
        if (saved[0]) {
            refresh();
            statusLabel.setText(existing == null ? "User created." : "User updated.");
        }
    }

    private void deleteUser() {
        User selected = table.getSelectionModel().getSelectedItem();
        if (selected == null) {
            UiUtils.warn(window(), "Select a user", "Choose a user to delete.");
            return;
        }
        if (selected.getId() == actor.getId()) {
            UiUtils.warn(window(), "Cannot delete yourself", "You are signed in with this account.");
            return;
        }
        if (!UiUtils.confirm(window(), "Delete user",
                "Delete " + selected.getFullName() + " (" + selected.getUsername() + ")?\n"
                        + "Users with clinical history cannot be deleted.")) {
            return;
        }
        try {
            context.userService().deleteUser(selected.getId());
            refresh();
            statusLabel.setText("User deleted.");
        } catch (DatabaseOperationException e) {
            UiUtils.error(window(), "Could not delete", e);
        }
    }

    private Window window() {
        return getScene() == null ? null : getScene().getWindow();
    }
}
