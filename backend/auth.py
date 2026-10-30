import datetime
import os
from typing import Optional
from sqlalchemy.orm import joinedload
from dotenv import load_dotenv
import jwt
from fastapi import Request, HTTPException, status, Response
from database import SessionLocal, User

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

JWT_PRIVATE_KEY = os.getenv("JWT_PRIVATE_KEY", "")
JWT_PUBLIC_KEY = os.getenv("JWT_PUBLIC_KEY", "")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "RS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "7"))
JWT_ISSUER = os.getenv("JWT_ISSUER", "mi-backend-seguro.com")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "mi-app-cliente.com")

# Esta variable controlará si las cookies requieren HTTPS (según tu .env)
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"


def create_token(user_id: int, token_type: str, expires_delta: datetime.timedelta) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    to_encode = {
        "sub": str(user_id),
        "type": token_type,
        "exp": now + expires_delta,
        "iat": now,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    }
    return jwt.encode(to_encode, JWT_PRIVATE_KEY, algorithm=JWT_ALGORITHM)


def verify_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            JWT_PUBLIC_KEY,
            algorithms=[JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
        if payload.get("type") != expected_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tipo de token inválido",
            )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token ha expirado",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no válido o manipulado",
        )


def _cookie_options(max_age: int) -> dict:
    return {
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": "lax",
        "max_age": max_age,
    }


def set_access_cookie(response: Response, user_id: int) -> None:
    access_token = create_token(
        user_id, "access", datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    response.set_cookie(
        key="access_token",
        value=access_token,
        **_cookie_options(ACCESS_TOKEN_EXPIRE_MINUTES * 60),
    )


def set_auth_cookies(response: Response, user_id: int) -> None:
    """
    Adjunta las cookies de acceso y refresco a una respuesta de FastAPI.
    SameSite=lax permite el flujo en desarrollo local con Vite como proxy.
    """
    set_access_cookie(response, user_id)

    refresh_token = create_token(
        user_id, "refresh", datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        path="/auth/refresh",
        **_cookie_options(REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60),
    )


def get_current_user_from_cookie(request: Request) -> Optional[User]:
    db = SessionLocal()
    try:
        token = request.cookies.get("access_token")
        if not token:
            return None
        payload = verify_token(token, expected_type="access")
        user_id = int(payload["sub"])
        return db.query(User).options(joinedload(User.role)).filter(User.id == user_id, User.is_active == True).first()
    except (HTTPException, KeyError, TypeError, ValueError):
        return None
    finally:
        db.close()


def require_auth(request: Request) -> User:
    user = get_current_user_from_cookie(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticación requerida",
        )
    return user
