package com.hospital.haes.util;

import java.util.function.Function;

/**
 * Small generic outcome wrapper used by reporting operations. Keeping
 * success and failure in one typed object avoids scattered null checks.
 */
public final class Result<T> {

    private final T value;
    private final String error;

    private Result(T value, String error) {
        this.value = value;
        this.error = error;
    }

    public static <T> Result<T> ok(T value) {
        return new Result<>(value, null);
    }

    public static <T> Result<T> fail(String error) {
        return new Result<>(null, error);
    }

    public boolean isSuccess() {
        return error == null;
    }

    public T getValue() {
        return value;
    }

    public String getError() {
        return error;
    }

    public T orElse(T fallback) {
        return isSuccess() ? value : fallback;
    }

    public <R> Result<R> map(Function<? super T, ? extends R> mapper) {
        if (!isSuccess()) {
            return Result.fail(error);
        }
        return Result.ok(mapper.apply(value));
    }
}
