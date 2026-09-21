from functools import lru_cache

import boto3
import requests
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError
from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.db import get_db
from backend.models import User, UserRole

security = HTTPBearer(auto_error=False)


@lru_cache
def get_cognito_jwks():
    settings = get_settings()

    jwks_url = (
        f"{settings.cognito_issuer}"
        "/.well-known/jwks.json"
    )

    try:
        response = requests.get(
            jwks_url,
            timeout=5,
        )
        response.raise_for_status()
        return response.json()

    except requests.RequestException:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable.",
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    settings = get_settings()

    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")

        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        jwks = get_cognito_jwks()

        key = next(
            (
                key
                for key in jwks.get("keys", [])
                if key.get("kid") == kid
            ),
            None,
        )

        if key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=settings.cognito_issuer,
            options={
                "verify_aud": False,
            },
        )

        if payload.get("iss") != settings.cognito_issuer:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token issuer.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if payload.get("token_use") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if payload.get("client_id") != settings.cognito_client_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not payload.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has no subject.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return payload

    except HTTPException:
        raise

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


@lru_cache
def get_cognito_client():
    settings = get_settings()

    return boto3.client(
        "cognito-idp",
        region_name=settings.cognito_region,
    )


def get_cognito_user_attributes(access_token: str) -> dict[str, str]:
    try:
        response = get_cognito_client().get_user(
            AccessToken=access_token,
        )

    except ClientError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to retrieve authenticated user.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    except BotoCoreError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable.",
        )

    return {
        attribute["Name"]: attribute["Value"]
        for attribute in response.get("UserAttributes", [])
    }


def get_or_create_user(
    current_user=Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    attributes = get_cognito_user_attributes(
        credentials.credentials,
    )

    email = attributes.get("email")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticated Cognito user has no email address.",
        )

    name = (
        attributes.get("name")
        or current_user.get("username")
        or current_user["sub"]
    )

    auth_subject = current_user["sub"]

    user = (
        db.query(User)
        .filter(User.auth_subject == auth_subject)
        .first()
    )

    if user is None:
        user = User(
            auth_subject=auth_subject,
            email=email,
            name=name,
        )

        db.add(user)
        db.commit()
        db.refresh(user)

    return user


def require_authenticated_user(
    current_user: User = Depends(get_or_create_user),
):
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    return current_user


def require_admin(
    current_user: User = Depends(require_authenticated_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )

    return current_user