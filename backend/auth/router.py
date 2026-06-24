# backend/auth/router.py
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth.service import (
    create_user,
    authenticate_user,
    initiate_password_reset,
    complete_password_reset,
)
from auth.dependencies import get_current_user
from auth.utils import create_token
from schemas import (
    SignupRequest,
    LoginRequest,
    UserResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    OkResponse,
)
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 604800 seconds


def _set_auth_cookie(response: Response, user_id: int) -> None:
    token = create_token(user_id)
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


@router.post("/signup", response_model=UserResponse)
async def signup(
    body: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    user = await create_user(db, body.email, body.password)
    _set_auth_cookie(response, user.id)
    return UserResponse(id=user.id, email=user.email)


@router.post("/login", response_model=UserResponse)
async def login(
    body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    user = await authenticate_user(db, body.email, body.password)
    _set_auth_cookie(response, user.id)
    return UserResponse(id=user.id, email=user.email)


@router.post("/logout", response_model=OkResponse)
async def logout(response: Response):
    response.delete_cookie(key="token", path="/")
    return OkResponse()


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse(id=current_user.id, email=current_user.email)


@router.post("/forgot-password", response_model=OkResponse)
async def forgot_password(
    body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
):
    await initiate_password_reset(db, body.email)
    return OkResponse()


@router.post("/reset-password", response_model=OkResponse)
async def reset_password(
    body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    await complete_password_reset(db, body.token, body.new_password)
    return OkResponse()
