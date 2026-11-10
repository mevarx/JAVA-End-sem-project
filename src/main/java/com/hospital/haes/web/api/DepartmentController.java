package com.hospital.haes.web.api;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.Department;
import com.hospital.haes.model.Role;
import com.hospital.haes.service.DepartmentService;
import com.hospital.haes.web.dto.DepartmentDto;
import com.hospital.haes.web.dto.DepartmentRequest;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    private final DepartmentService departmentService;
    private final ApiMapper mapper;

    public DepartmentController(DepartmentService departmentService, ApiMapper mapper) {
        this.departmentService = departmentService;
        this.mapper = mapper;
    }

    @GetMapping
    public List<DepartmentDto> list() throws DatabaseOperationException {
        return departmentService.listAll().stream().map(mapper::toDto).toList();
    }

    @PostMapping
    @RequireRole(Role.ADMIN)
    public ResponseEntity<DepartmentDto> create(@RequestBody DepartmentRequest request)
            throws ValidationException, DatabaseOperationException {
        Department created = departmentService.create(request.name());
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toDto(created));
    }

    @PutMapping("/{id}")
    @RequireRole(Role.ADMIN)
    public DepartmentDto update(@PathVariable int id, @RequestBody DepartmentRequest request)
            throws ValidationException, DatabaseOperationException {
        departmentService.update(id, request.name());
        return departmentService.listAll().stream()
                .filter(department -> department.getId() == id)
                .map(mapper::toDto)
                .findFirst()
                .orElseThrow();
    }

    @DeleteMapping("/{id}")
    @RequireRole(Role.ADMIN)
    public ResponseEntity<Void> delete(@PathVariable int id)
            throws ValidationException, DatabaseOperationException {
        departmentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
