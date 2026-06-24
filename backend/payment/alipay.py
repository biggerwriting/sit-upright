# backend/payment/alipay.py
"""
支付宝 SDK 封装。
当 ALIPAY_APP_ID 未设置时自动进入 Mock 模式：
  - create_qr_code: 返回带 out_trade_no 的 mock URL
  - verify_notify_signature: 始终返回 True
"""
import os
from dotenv import load_dotenv

load_dotenv()

MOCK_MODE = not bool(os.getenv("ALIPAY_APP_ID"))


def create_qr_code(out_trade_no: str, amount_yuan: str, subject: str) -> str:
    """调支付宝 precreate 接口，返回二维码内容字符串。Mock 模式返回固定值。"""
    if MOCK_MODE:
        return f"mock-alipay-qr://{out_trade_no}"

    from alipay import AliPay  # 延迟导入，避免无凭证时报错

    client = AliPay(
        appid=os.getenv("ALIPAY_APP_ID"),
        app_notify_url=os.getenv("ALIPAY_NOTIFY_URL"),
        app_private_key_string=os.getenv("ALIPAY_PRIVATE_KEY", "").replace("\\n", "\n"),
        alipay_public_key_string=os.getenv("ALIPAY_PUBLIC_KEY", "").replace("\\n", "\n"),
        sign_type="RSA2",
        debug="sandbox" in os.getenv("ALIPAY_GATEWAY", ""),
    )
    response = client.api_alipay_trade_precreate(
        subject=subject,
        out_trade_no=out_trade_no,
        total_amount=amount_yuan,
    )
    if response.get("code") != "10000":
        raise RuntimeError(f"支付宝建单失败: {response}")
    return response["qr_code"]


def verify_notify_signature(params: dict) -> bool:
    """验证支付宝回调签名。Mock 模式始终返回 True。"""
    if MOCK_MODE:
        return True

    from alipay import AliPay

    client = AliPay(
        appid=os.getenv("ALIPAY_APP_ID"),
        app_notify_url=None,
        app_private_key_string=os.getenv("ALIPAY_PRIVATE_KEY", "").replace("\\n", "\n"),
        alipay_public_key_string=os.getenv("ALIPAY_PUBLIC_KEY", "").replace("\\n", "\n"),
        sign_type="RSA2",
        debug="sandbox" in os.getenv("ALIPAY_GATEWAY", ""),
    )
    sign = params.pop("sign", None)
    return client.verify(params, sign)
