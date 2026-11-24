import uuid
from typing import Optional
from fastapi import Header, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel
from app.config import settings
from app.core.exceptions import AuthenticationException

security_bearer = HTTPBearer(auto_error=False)

class AuthenticatedUser(BaseModel):
    user_id: uuid.UUID
    email: str
    role: str = "CUSTOMER"

def verify_internal_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> bool:
    """
    Verifies service-to-service calls between Java Spring Boot and Python FastAPI.
    """
    if not settings.INTERNAL_API_KEY:
        return True
    if not x_api_key or x_api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal service API key."
        )
    return True

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
) -> AuthenticatedUser:
    """
    Decodes the stateless JWT issued by CineBook Java Spring Boot.
    Enforces user identification for personalized AI operations.
    """
    if not credentials or not credentials.credentials:
        raise AuthenticationException("Authorization bearer token is required.")

    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id_str = payload.get("sub") or payload.get("userId") or payload.get("user_id")
        email = payload.get("email") or payload.get("sub") or "anonymous@cinebook.com"
        role = payload.get("role") or "CUSTOMER"

        if not user_id_str:
            raise AuthenticationException("JWT missing valid user identifier.")

        return AuthenticatedUser(
            user_id=uuid.UUID(str(user_id_str)),
            email=str(email),
            role=str(role)
        )
    except (JWTError, ValueError) as e:
        raise AuthenticationException(f"Invalid or expired JWT token: {str(e)}")

def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
) -> Optional[AuthenticatedUser]:
    """
    Optional user authentication for endpoints accessible both anonymously and authenticated.
    """
    if not credentials or not credentials.credentials:
        return None
    try:
        return get_current_user(credentials)
    except AuthenticationException:
        return None
