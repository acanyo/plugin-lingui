package com.acanyo.halo.plugin.lingui.ai.validation;

final class ValidationErrors {
    private ValidationErrors() {}
    static IllegalArgumentException bad(String message) { return new IllegalArgumentException(message); }
}
