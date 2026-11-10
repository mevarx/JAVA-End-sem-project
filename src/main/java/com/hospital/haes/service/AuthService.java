package com.hospital.haes.service;

import com.hospital.haes.dao.UserDao;
import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Patient;
import com.hospital.haes.model.User;
import com.hospital.haes.util.PasswordHasher;
import com.hospital.haes.util.Validator;

import java.util.Optional;

public class AuthService {

    private final UserDao userDao;

    public AuthService(UserDao userDao) {
        this.userDao = userDao;
    }

    public User login(String username, String password)
            throws DatabaseOperationException, UnauthorizedActionException {
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            throw new UnauthorizedActionException("Enter both username and password.");
        }
        Optional<User> found = userDao.findByUsername(username.trim());
        if (found.isEmpty() || !found.get().isActive()
                || !PasswordHasher.verify(password, found.get().getPasswordHash())) {
            throw new UnauthorizedActionException("Invalid username or password.");
        }
        return found.get();
    }

    public User registerPatient(String username, String password, String fullName, String phone)
            throws ValidationException, DatabaseOperationException {
        Validator.username(username);
        Validator.password(password);
        Validator.requireText(fullName, "Full name");
        Validator.maxLength(fullName.trim(), 100, "Full name");
        Validator.phone(phone);
        if (userDao.findByUsername(username.trim()).isPresent()) {
            throw new ValidationException("That username is already taken.");
        }
        Patient patient = new Patient(0, username.trim(), PasswordHasher.hash(password),
                fullName.trim(), phone == null ? null : phone.trim(), null, true);
        return userDao.save(patient);
    }

    public void changePassword(User user, String currentPassword, String newPassword)
            throws DatabaseOperationException, UnauthorizedActionException, ValidationException {
        if (user == null) {
            throw new UnauthorizedActionException("You are not signed in.");
        }
        if (!PasswordHasher.verify(currentPassword, user.getPasswordHash())) {
            throw new UnauthorizedActionException("The current password is incorrect.");
        }
        Validator.password(newPassword);
        String newHash = PasswordHasher.hash(newPassword);
        String previousHash = user.getPasswordHash();
        // Persist first so a failed write leaves the session object consistent with the database.
        user.setPasswordHash(newHash);
        try {
            userDao.update(user);
        } catch (RuntimeException e) {
            user.setPasswordHash(previousHash);
            throw e;
        }
    }
}
