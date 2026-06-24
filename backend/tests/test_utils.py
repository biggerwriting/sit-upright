import pytest
from jose import JWTError
from auth.utils import hash_password, verify_password, create_token, decode_token


def test_hash_and_verify():
    hashed = hash_password("mypassword")
    assert hashed != "mypassword"
    assert verify_password("mypassword", hashed) is True
    assert verify_password("wrongpassword", hashed) is False


def test_create_and_decode_token():
    token = create_token(42)
    assert isinstance(token, str)
    user_id = decode_token(token)
    assert user_id == 42


def test_decode_invalid_token():
    with pytest.raises(JWTError):
        decode_token("not.a.valid.token")


def test_decode_tampered_token():
    token = create_token(1)
    tampered = token[:-5] + "XXXXX"
    with pytest.raises(JWTError):
        decode_token(tampered)
