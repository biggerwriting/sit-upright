# backend/schemas.py
from pydantic import BaseModel, EmailStr, Field, field_validator


class SignupRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("密码至少 8 位")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("密码至少 8 位")
        return v


class OkResponse(BaseModel):
    ok: bool = True


from datetime import datetime as dt


class NearExpiry(BaseModel):
    seconds: int
    expiresAt: dt


class QuotaResponse(BaseModel):
    remainingSeconds: int
    nearExpiry: NearExpiry | None = None


class CreateSessionResponse(BaseModel):
    sessionId: str


class UpdateSessionRequest(BaseModel):
    goodSeconds: int = Field(ge=0)
    badSeconds: int = Field(ge=0)


class UpdateSessionResponse(BaseModel):
    ok: bool = True


class SessionStatsSegment(BaseModel):
    type: str            # "good" | "bad"
    durationSeconds: int


class SessionStatsResponse(BaseModel):
    totalSeconds: int
    goodSeconds: int
    badSeconds: int
    segments: list[SessionStatsSegment]


class SessionListItem(BaseModel):
    id: str
    startedAt: dt
    endedAt: dt
    totalSeconds: int
    goodSeconds: int
    badSeconds: int

class SessionListResponse(BaseModel):
    sessions: list[SessionListItem]
    hasMore: bool


class CreateOrderResponse(BaseModel):
    orderId: str
    qrCode: str


class OrderResponse(BaseModel):
    id: str
    status: str  # "pending" | "paid" | "failed"
