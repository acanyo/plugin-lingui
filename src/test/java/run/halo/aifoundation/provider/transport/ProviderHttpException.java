package run.halo.aifoundation.provider.transport;

/** Test fixture for Foundation's internal transport exception, which is absent from its API JAR. */
public final class ProviderHttpException extends RuntimeException {
    public ProviderHttpException(String message) {
        super(message);
    }
}
