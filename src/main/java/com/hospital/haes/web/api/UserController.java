package com.hospital.haes.web.api;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Role;
import com.hospital.haes.model.User;
import com.hospital.haes.service.UserService;
import com.hospital.haes.web.dto.CreateUserRequest;
import com.hospital.haes.web.dto.UpdateUserRequest;
import com.hospital.haes.web.dto.UserDto;
import com.hospital.haes.web.mapper.ApiMapper;
import com.hospital.haes.web.security.RequireRole;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final ApiMapper mapper;

    public UserController(UserService userService, ApiMapper mapper) {
        this.userService = userService;
        this.mapper = mapper;
    }

    @GetMapping
    @RequireRole(Role.ADMIN)
    public List<UserDto> list(@RequestParam(required = false) String role)
            throws DatabaseOperationException {
        List<User> users = role == null || role.isBlank()
                ? userService.listAll()
                : userService.listByRole(Role.valueOf(role));
        return users.stream().map(mapper::toDto).toList();
    }

    @GetMapping("/patients")
    @RequireRole({Role.RECEPTIONIST, Role.ER_STAFF, Role.DOCTOR, Role.ADMIN})
    public List<UserDto> patients() throws DatabaseOperationException {
        return userService.listPatients().stream().map(mapper::toDto).toList();
    }

    @GetMapping("/doctors")
    public List<UserDto> doctors() throws DatabaseOperationException {
        return userService.listDoctors().stream().map(mapper::toDto).toList();
    }

    @GetMapping("/responders")
    @RequireRole(Role.ADMIN)
    public List<UserDto> responders() throws DatabaseOperationException {
        return userService.listResponders().stream().map(mapper::toDto).toList();
    }

    @GetMapping("/{id}")
    @RequireRole(Role.ADMIN)
    public UserDto get(@PathVariable int id) throws DatabaseOperationException, ValidationException {
        return mapper.toDto(userService.getById(id));
    }

    @PostMapping
    @RequireRole(Role.ADMIN)
    public ResponseEntity<UserDto> create(@RequestBody CreateUserRequest request)
            throws ValidationException, DatabaseOperationException {
        if (request.role() == null) {
            throw new ValidationException("Select a role.");
        }
        User created = userService.createUser(
                request.username(), request.password(), Role.valueOf(request.role()),
                request.fullName(), request.phone(), request.departmentId(),
                request.specialization(), Boolean.TRUE.equals(request.onCall()));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toDto(created));
    }

    @PutMapping("/{id}")
    @RequireRole(Role.ADMIN)
    public UserDto update(@PathVariable int id, @RequestBody UpdateUserRequest request)
            throws ValidationException, DatabaseOperationException {
        if (request.role() == null) {
            throw new ValidationException("Select a role.");
        }
        userService.updateUser(id, request.username(), request.newPassword(),
                Role.valueOf(request.role()), request.fullName(), request.phone(),
                request.departmentId(), request.specialization(),
                Boolean.TRUE.equals(request.onCall()));
        return mapper.toDto(userService.getById(id));
    }

    @DeleteMapping("/{id}")
    @RequireRole(Role.ADMIN)
    public ResponseEntity<Void> delete(@PathVariable int id) throws DatabaseOperationException {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
