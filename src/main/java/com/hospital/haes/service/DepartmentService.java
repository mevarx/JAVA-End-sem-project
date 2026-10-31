package com.hospital.haes.service;

import com.hospital.haes.dao.DepartmentDao;
import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Department;

import java.util.List;

public class DepartmentService {

    private final DepartmentDao departmentDao;

    public DepartmentService(DepartmentDao departmentDao) {
        this.departmentDao = departmentDao;
    }

    public List<Department> listAll() throws DatabaseOperationException {
        return departmentDao.findAll();
    }

    public Department create(String name) throws ValidationException, DatabaseOperationException {
        String clean = validateName(name);
        if (departmentDao.findByName(clean).isPresent()) {
            throw new ValidationException("A department with that name already exists.");
        }
        return departmentDao.save(new Department(clean));
    }

    public void update(int id, String name) throws ValidationException, DatabaseOperationException {
        String clean = validateName(name);
        Department department = departmentDao.findById(id)
                .orElseThrow(() -> new ValidationException("Department not found."));
        var existing = departmentDao.findByName(clean);
        if (existing.isPresent() && existing.get().getId() != id) {
            throw new ValidationException("A department with that name already exists.");
        }
        department.setName(clean);
        departmentDao.update(department);
    }

    public void delete(int id) throws ValidationException, DatabaseOperationException {
        if (departmentDao.countUsers(id) > 0) {
            throw new ValidationException("Move the department's users to another department first.");
        }
        departmentDao.delete(id);
    }

    private String validateName(String name) throws ValidationException {
        if (name == null || name.isBlank()) {
            throw new ValidationException("Department name is required.");
        }
        String clean = name.trim();
        if (clean.length() > 60) {
            throw new ValidationException("Department name must be at most 60 characters.");
        }
        return clean;
    }
}
