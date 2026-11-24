from typing import Any, Dict, Optional
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from app.core.logging import logger

class AIServiceException(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}

class AuthenticationException(AIServiceException):
    def __init__(self, message: str = "Invalid authentication credentials"):
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)

class AuthorizationException(AIServiceException):
    def __init__(self, message: str = "Operation not permitted for this user"):
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN)

class ResourceNotFoundException(AIServiceException):
    def __init__(self, message: str = "Requested resource not found"):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)

class RateLimitException(AIServiceException):
    def __init__(self, message: str = "Rate limit exceeded. Please retry later"):
        super().__init__(message, status_code=status.HTTP_429_TOO_MANY_REQUESTS)

class LLMProviderException(AIServiceException):
    def __init__(self, message: str = "LLM upstream inference failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=status.HTTP_502_BAD_GATEWAY, details=details)

def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AIServiceException)
    async def ai_service_exception_handler(request: Request, exc: AIServiceException):
        logger.warning(
            f"Handled application exception on {request.url.path}: {exc.message}",
            extra={"path": request.url.path}
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": exc.__class__.__name__,
                    "message": exc.message,
                    "details": exc.details
                }
            }
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(
            f"Unhandled exception on {request.url.path}: {str(exc)}",
            exc_info=True,
            extra={"path": request.url.path}
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "InternalServerError",
                    "message": "An unexpected error occurred processing your request."
                }
            }
        )
