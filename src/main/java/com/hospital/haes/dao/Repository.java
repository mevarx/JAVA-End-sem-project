package com.hospital.haes.dao;

import com.hospital.haes.exception.DatabaseOperationException;

import java.util.List;
import java.util.Optional;

/**
 * Generic CRUD contract implemented by every DAO. Services depend on this
 * abstraction rather than concrete JDBC classes.
 */
public interface Repository<T, ID> {

    T save(T entity) throws DatabaseOperationException;

    Optional<T> findById(ID id) throws DatabaseOperationException;

    List<T> findAll() throws DatabaseOperationException;

    void update(T entity) throws DatabaseOperationException;

    void delete(ID id) throws DatabaseOperationException;
}
