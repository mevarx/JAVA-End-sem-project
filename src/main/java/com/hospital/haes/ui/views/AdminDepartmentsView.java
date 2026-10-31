package com.hospital.haes.ui.views;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Department;
import com.hospital.haes.ui.AppContext;
import com.hospital.haes.ui.UiUtils;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TableView;
import javafx.scene.control.TextInputDialog;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Window;

import java.util.Optional;

public class AdminDepartmentsView extends BorderPane implements Refreshable {

    private final AppContext context;
    private final TableView<Department> table = new TableView<>();
    private final Label statusLabel = new Label("Ready");

    public AdminDepartmentsView(AppContext context) {
        this.context = context;
        setPadding(new Insets(16));
        setTop(buildHeader());
        setCenter(buildTable());
        setBottom(buildActions());
        refresh();
    }

    private VBox buildHeader() {
        Label title = new Label("Departments");
        title.getStyleClass().add("section-title");
        Label subtitle = new Label("Departments group doctors for booking filters and emergency specialization matching.");
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

    private TableView<Department> buildTable() {
        table.getColumns().add(UiUtils.column("ID", 60, department -> String.valueOf(department.getId())));
        table.getColumns().add(UiUtils.column("Name", 320, Department::getName));
        table.getColumns().add(UiUtils.column("Users", 100, department -> {
            try {
                return String.valueOf(context.departmentDao().countUsers(department.getId()));
            } catch (DatabaseOperationException e) {
                return "?";
            }
        }));
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        table.setPlaceholder(new Label("No departments found."));
        return table;
    }

    private VBox buildActions() {
        Button add = new Button("Add department");
        add.getStyleClass().add("primary-button");
        add.setOnAction(event -> edit(null));

        Button rename = new Button("Rename");
        rename.getStyleClass().add("secondary-button");
        rename.setOnAction(event -> {
            Department selected = table.getSelectionModel().getSelectedItem();
            if (selected == null) {
                UiUtils.warn(window(), "Select a department", "Choose a department to rename.");
            } else {
                edit(selected);
            }
        });

        Button delete = new Button("Delete department");
        delete.getStyleClass().add("danger-button");
        delete.setOnAction(event -> delete());

        HBox actions = new HBox(10, add, rename, delete);
        actions.setAlignment(Pos.CENTER_LEFT);
        actions.setPadding(new Insets(12, 0, 0, 0));
        return new VBox(actions);
    }

    @Override
    public void refresh() {
        try {
            table.getItems().setAll(context.departmentService().listAll());
            statusLabel.setText(table.getItems().size() + " department(s).");
        } catch (DatabaseOperationException e) {
            statusLabel.setText("Could not load departments: " + e.getMessage());
        }
    }

    private void edit(Department existing) {
        TextInputDialog dialog = new TextInputDialog(existing == null ? "" : existing.getName());
        dialog.initOwner(window());
        dialog.setTitle(existing == null ? "Add department" : "Rename department");
        dialog.setHeaderText(existing == null ? "New department" : "Rename " + existing.getName());
        dialog.setContentText("Name:");
        Optional<String> result = dialog.showAndWait();
        if (result.isEmpty()) {
            return;
        }
        try {
            if (existing == null) {
                context.departmentService().create(result.get());
            } else {
                context.departmentService().update(existing.getId(), result.get());
            }
            refresh();
            statusLabel.setText(existing == null ? "Department created." : "Department renamed.");
        } catch (ValidationException e) {
            UiUtils.error(window(), "Check the department name", e.getMessage());
        } catch (DatabaseOperationException e) {
            UiUtils.error(window(), "Database error", e);
        }
    }

    private void delete() {
        Department selected = table.getSelectionModel().getSelectedItem();
        if (selected == null) {
            UiUtils.warn(window(), "Select a department", "Choose a department to delete.");
            return;
        }
        if (!UiUtils.confirm(window(), "Delete department",
                "Delete " + selected.getName() + "? Departments with users cannot be deleted.")) {
            return;
        }
        try {
            context.departmentService().delete(selected.getId());
            refresh();
            statusLabel.setText("Department deleted.");
        } catch (ValidationException e) {
            UiUtils.error(window(), "Department in use", e.getMessage());
        } catch (DatabaseOperationException e) {
            UiUtils.error(window(), "Could not delete", e);
        }
    }

    private Window window() {
        return getScene() == null ? null : getScene().getWindow();
    }
}
