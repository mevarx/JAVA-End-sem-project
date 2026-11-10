package com.hospital.haes.web.api;

import com.hospital.haes.exception.DatabaseOperationException;
import com.hospital.haes.exception.UnauthorizedActionException;
import com.hospital.haes.exception.ValidationException;
import com.hospital.haes.model.User;
import com.hospital.haes.service.AuthService;
import com.hospital.haes.service.UserService;
import com.hospital.haes.web.dto.ApiError;
import com.hospital.haes.web.dto.ChangePasswordRequest;
import com.hospital.haes.web.dto.LoginRequest;
import com.hospital.haes.web.dto.LoginResponse;
import com.hospital.haes.web.dto.RegisterRequest;
import com.hospital.haes.web.dto.UserDto;
import com.hospital.haes.web.mapper.ApiMapper;
import com.hospital.haes.web.security.CurrentUser;
import com.hospital.haes.web.security.SessionInterceptor;
import com.hospital.haes.web.security.SessionRegistry;
import com.hospital.haes.web.security.WebSession;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UserService userService;
    private final SessionRegistry sessions;
    private final ApiMapper mapper;

    public AuthController(AuthService authService, UserService userService,
                          SessionRegistry sessions, ApiMapper mapper) {
        this.authService = authService;
        this.userService = userService;
        this.sessions = sessions;
        this.mapper = mapper;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpServletResponse response) {
        try {
            User user = authService.login(request.username(), request.password());
            WebSession session = sessions.create(user);
            response.addHeader(HttpHeaders.SET_COOKIE, sessionCookie(session.token()).toString());
            return ResponseEntity.ok(new LoginResponse(mapper.toDto(user)));
        } catch (UnauthorizedActionException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiError(401, "Unauthorized", e.getMessage(), LocalDateTime.now()));
        } catch (DatabaseOperationException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiError(500, "Database error",
                            "Could not sign in right now. Please try again.", LocalDateTime.now()));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<LoginResponse> register(@RequestBody RegisterRequest request,
                                                  HttpServletResponse response)
            throws ValidationException, DatabaseOperationException {
        User user = authService.registerPatient(request.username(), request.password(),
                request.fullName(), request.phone());
        WebSession session = sessions.create(user);
        response.addHeader(HttpHeaders.SET_COOKIE, sessionCookie(session.token()).toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(new LoginResponse(mapper.toDto(user)));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        sessions.remove(readToken(request));
        ResponseCookie cleared = ResponseCookie.from(SessionInterceptor.COOKIE_NAME, "")
                .httpOnly(true).sameSite("Lax").path("/").maxAge(0).build();
        response.addHeader(HttpHeaders.SET_COOKIE, cleared.toString());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public UserDto me(HttpServletRequest request)
            throws DatabaseOperationException, ValidationException {
        WebSession session = CurrentUser.of(request);
        return mapper.toDto(userService.getById(session.userId()));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(@RequestBody ChangePasswordRequest request,
                                               HttpServletRequest httpRequest)
            throws DatabaseOperationException, ValidationException, UnauthorizedActionException {
        WebSession session = CurrentUser.of(httpRequest);
        User user = userService.getById(session.userId());
        authService.changePassword(user, request.currentPassword(), request.newPassword());
        return ResponseEntity.noContent().build();
    }

    private ResponseCookie sessionCookie(String token) {
        return ResponseCookie.from(SessionInterceptor.COOKIE_NAME, token)
                .httpOnly(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(SessionRegistry.idleTimeout())
                .build();
    }

    private String readToken(HttpServletRequest request) {
        var cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (var cookie : cookies) {
            if (SessionInterceptor.COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
