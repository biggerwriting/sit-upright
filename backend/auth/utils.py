import os
from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext
import aiosmtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-key-please-change-in-production-32chars")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_DAYS = 7


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def decode_token(token: str) -> int:
    """Returns user_id. Raises JWTError if token is invalid or expired."""
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    return int(payload["sub"])


async def send_reset_email(to_email: str, reset_url: str) -> None:
    msg = EmailMessage()
    msg["From"] = os.getenv("SMTP_FROM", "noreply@example.com")
    msg["To"] = to_email
    msg["Subject"] = "重置您的坐姿检测账户密码"
    msg.set_content(
        f"点击以下链接重置密码（1小时内有效）：\n\n{reset_url}\n\n"
        "如非本人操作，请忽略此邮件。"
    )
    await aiosmtplib.send(
        msg,
        hostname=os.getenv("SMTP_HOST", "smtp.gmail.com"),
        port=int(os.getenv("SMTP_PORT", "587")),
        username=os.getenv("SMTP_USER"),
        password=os.getenv("SMTP_PASSWORD"),
        start_tls=True,
    )
