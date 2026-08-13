class AppException(Exception):
    def __init__(
        self,
        message: str | None = None,
        status_code: int = 400,
        error_code: str = "APP_ERROR",
        detail: str | None = None,
    ):
        self.message = message or detail or "An error occurred"
        self.status_code = status_code
        self.error_code = error_code