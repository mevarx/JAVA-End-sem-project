package com.hospital.haes.service;

import com.hospital.haes.dao.DepartmentDao;
import com.hospital.haes.dao.UserDao;
import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Admin;
import com.hospital.haes.model.Department;
import com.hospital.haes.model.Doctor;
import com.hospital.haes.model.ErStaff;
import com.hospital.haes.model.Patient;
import com.hospital.haes.model.Receptionist;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.User;
import com.hospital.haes.util.PasswordHasher;
import com.hospital.haes.util.Validator;

import java.util.List;
import java.util.Optional;

/**
 * Administration of accounts and doctor metadata. UI controllers call this
 * service; SQL and validation stay out of JavaFX classes.
 */
public class UserService {

    private final UserDao userDao;
    private final DepartmentDao departmentDao;

    public UserService(UserDao userDao, DepartmentDao departmentDao) {
        this.userDao = userDao;
        this.departmentDao = departmentDao;
    }

    public List<User> listAll() throws DatabaseOperationException {
        return userDao.findAll();
    }

    public List<User> listByRole(Role role) throws DatabaseOperationException {
        return userDao.findByRole(role);
    }

    public List<User> listPatients() throws DatabaseOperationException {
        return userDao.findByRole(Role.PATIENT);
    }

    public List<User> listDoctors() throws DatabaseOperationException {
        return userDao.findByRole(Role.DOCTOR);
    }

    public List<User> listResponders() throws DatabaseOperationException {
        return userDao.findResponders();
    }

    public List<Department> listDepartments() throws DatabaseOperationException {
        return departmentDao.findAll();
    }

    public User getById(int id) throws DatabaseOperationException, ValidationException {
        return userDao.findById(id)
                .orElseThrow(() -> new ValidationException("User not found."));
    }

    public User createUser(String username, String password, Role role, String fullName,
                           String phone, Integer departmentId, String specialization,
                           boolean onCall) throws ValidationException, DatabaseOperationException {
        validateCommon(username, fullName, phone, departmentId);
        Validator.password(password);
        if (userDao.findByUsername(username.trim()).isPresent()) {
            throw new ValidationException("That username is already taken.");
        }
        String hash = PasswordHasher.hash(password);
        User user = build(0, username.trim(), hash, role, fullName.trim(), phone,
                departmentId, specialization, onCall, true);
        return userDao.save(user);
    }

    public void updateUser(int id, String username, String newPassword, Role role,
                           String fullName, String phone, Integer departmentId,
                           String specialization, boolean onCall)
            throws ValidationException, DatabaseOperationException {
        User existing = userDao.findById(id)
                .orElseThrow(() -> new ValidationException("User not found."));
        validateCommon(username, fullName, phone, departmentId);
        Optional<User> sameName = userDao.findByUsername(username.trim());
        if (sameName.isPresent() && sameName.get().getId() != id) {
            throw new ValidationException("That username is already taken.");
        }
        String hash = existing.getPasswordHash();
        if (newPassword != null && !newPassword.isBlank()) {
            Validator.password(newPassword);
            hash = PasswordHasher.hash(newPassword);
        }
        User updated = build(id, username.trim(), hash, role, fullName.trim(), phone,
                departmentId, specialization, onCall, existing.isActive());
        userDao.update(updated);
    }

    public void deleteUser(int id) throws DatabaseOperationException {
        userDao.delete(id);
    }

    private void validateCommon(String username, String fullName, String phone, Integer departmentId)
            throws ValidationException, DatabaseOperationException {
        Validator.username(username);
        Validator.requireText(fullName, "Full name");
        Validator.maxLength(fullName.trim(), 100, "Full name");
        Validator.phone(phone);
        if (departmentId != null && departmentDao.findById(departmentId).isEmpty()) {
            throw new ValidationException("Select a valid department.");
        }
    }

    private User build(int id, String username, String hash, Role role, String fullName,
                       String phone, Integer departmentId, String specialization,
                       boolean onCall, boolean active) throws ValidationException {
        String cleanPhone = phone == null || phone.isBlank() ? null : phone.trim();
        if (role == null) {
            throw new ValidationException("Select a role.");
        }
        return switch (role) {
            case PATIENT -> new Patient(id, username, hash, fullName, cleanPhone, departmentId, active);
            case DOCTOR -> {
                if (specialization == null || specialization.isBlank()) {
                    throw new ValidationException("A doctor needs a specialization (for emergency matching).");
                }
                yield new Doctor(id, username, hash, fullName, cleanPhone, departmentId, active,
                        specialization.trim(), onCall);
            }
            case RECEPTIONIST -> new Receptionist(id, username, hash, fullName, cleanPhone, departmentId, active);
            case ER_STAFF -> new ErStaff(id, username, hash, fullName, cleanPhone, departmentId, active);
            case ADMIN -> new Admin(id, username, hash, fullName, cleanPhone, departmentId, active);
        };
    }
}
