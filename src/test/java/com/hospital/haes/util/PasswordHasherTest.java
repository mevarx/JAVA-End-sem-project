package com.hospital.haes.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordHasherTest {

    @Test
    @DisplayName("Hashes use the documented PBKDF2 format and verify correct passwords")
    void hashAndVerify() {
        String hash = PasswordHasher.hash("correct horse battery staple");

        String[] parts = hash.split("\\$");
        assertEquals(4, parts.length);
        assertEquals("pbkdf2", parts[0]);
        assertEquals("65536", parts[1]);
        assertTrue(PasswordHasher.verify("correct horse battery staple", hash));
        assertFalse(PasswordHasher.verify("WrongPassword", hash));
    }

    @Test
    @DisplayName("Equal passwords receive different salts")
    void hashesAreSalted() {
        String first = PasswordHasher.hash("same-password");
        String second = PasswordHasher.hash("same-password");

        assertNotEquals(first, second);
        assertTrue(PasswordHasher.verify("same-password", first));
        assertTrue(PasswordHasher.verify("same-password", second));
    }

    @Test
    @DisplayName("Malformed or missing stored hashes fail closed")
    void malformedHashesFailClosed() {
        assertFalse(PasswordHasher.verify("anything", null));
        assertFalse(PasswordHasher.verify(null, PasswordHasher.hash("anything")));
        assertFalse(PasswordHasher.verify("anything", ""));
        assertFalse(PasswordHasher.verify("anything", "plaintext"));
        assertFalse(PasswordHasher.verify("anything", "pbkdf2$not-a-number$AAAA$AAAA"));
        assertFalse(PasswordHasher.verify("anything", "pbkdf2$65536$AAAA$AAAA"));
        assertThrows(IllegalArgumentException.class, () -> PasswordHasher.hash(null));
    }
}
