"""Payment provider abstraction.

Mobile Money flows are *authorization-based*: FORK asks the operator to prompt the
customer on their own handset; the customer approves there. FORK never sees, asks
for, stores or transmits a PIN. Merchant numbers live only in backend settings.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import httpx

from app.core.config import Settings
from app.models import PaymentProviderName, PaymentStatus

log = logging.getLogger(__name__)

PHONE_RE = re.compile(r"^\+?[0-9]{9,15}$")


class PaymentProviderError(Exception):
    def __init__(self, message: str, code: str = "provider_error") -> None:
        super().__init__(message)
        self.code = code


def normalize_phone(phone: str, default_country: str = "256") -> str:
    digits = re.sub(r"[^\d+]", "", phone.strip())
    if not PHONE_RE.match(digits):
        raise PaymentProviderError("Enter a valid Mobile Money phone number", "invalid_phone")
    digits = digits.lstrip("+")
    if digits.startswith("0"):
        digits = default_country + digits[1:]
    return digits


def mask_phone(phone: str) -> str:
    return f"{phone[:3]}****{phone[-3:]}" if len(phone) > 6 else "****"


@dataclass
class InitiationResult:
    provider_reference: str
    status: PaymentStatus
    instructions: str
    payload: dict[str, object] = field(default_factory=dict)


@dataclass
class VerificationResult:
    status: PaymentStatus
    failure_reason: str | None = None
    payload: dict[str, object] = field(default_factory=dict)


@dataclass
class WebhookEvent:
    provider_reference: str
    status: PaymentStatus
    failure_reason: str | None = None
    payload: dict[str, object] = field(default_factory=dict)


class PaymentProvider(ABC):
    name: PaymentProviderName
    is_demo: bool = False

    @abstractmethod
    def initiate(self, payment_id: uuid.UUID, amount_minor: int, currency: str, payer_phone: str, note: str) -> InitiationResult: ...

    @abstractmethod
    def verify(self, provider_reference: str) -> VerificationResult: ...

    @abstractmethod
    def parse_webhook(self, headers: dict[str, str], body: bytes) -> WebhookEvent: ...


class MobileMoneyProvider(PaymentProvider):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _client(self) -> httpx.Client:
        return httpx.Client(timeout=20)

    def _verify_signature(self, secret: str, headers: dict[str, str], body: bytes, header_name: str) -> None:
        if not secret:
            raise PaymentProviderError("Webhook secret not configured", "webhook_unconfigured")
        signature = headers.get(header_name.lower()) or headers.get(header_name) or ""
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise PaymentProviderError("Invalid webhook signature", "bad_signature")


class MTNProvider(MobileMoneyProvider):
    """MTN MoMo Collections: `requesttopay` prompts the customer on their handset."""

    name = PaymentProviderName.MTN

    def _token(self) -> str:
        s = self.settings
        if not (s.mtn_api_user and s.mtn_api_key and s.mtn_subscription_key):
            raise PaymentProviderError("MTN Mobile Money is not configured on this server", "not_configured")
        with self._client() as c:
            r = c.post(
                f"{s.mtn_base_url}/collection/token/",
                auth=(s.mtn_api_user, s.mtn_api_key),
                headers={"Ocp-Apim-Subscription-Key": s.mtn_subscription_key},
            )
        if r.status_code >= 400:
            raise PaymentProviderError("MTN authentication failed", "auth")
        return str(r.json()["access_token"])

    def initiate(self, payment_id: uuid.UUID, amount_minor: int, currency: str, payer_phone: str, note: str) -> InitiationResult:
        s = self.settings
        token = self._token()
        reference = str(uuid.uuid4())
        body = {
            "amount": str(amount_minor),
            "currency": currency,
            "externalId": str(payment_id),
            "payer": {"partyIdType": "MSISDN", "partyId": payer_phone},
            "payerMessage": note[:160],
            "payeeNote": "FORK subscription",
        }
        with self._client() as c:
            r = c.post(
                f"{s.mtn_base_url}/collection/v1_0/requesttopay",
                json=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Reference-Id": reference,
                    "X-Target-Environment": s.mtn_environment,
                    "Ocp-Apim-Subscription-Key": s.mtn_subscription_key,
                    "X-Callback-Url": f"{s.public_api_url}/api/payments/webhooks/mtn",
                },
            )
        if r.status_code not in (200, 202):
            raise PaymentProviderError(f"MTN rejected the request ({r.status_code})", "rejected")
        return InitiationResult(
            provider_reference=reference,
            status=PaymentStatus.PROCESSING,
            instructions="Check your phone: MTN will prompt you to approve the payment with your own PIN on your handset.",
        )

    def verify(self, provider_reference: str) -> VerificationResult:
        s = self.settings
        token = self._token()
        with self._client() as c:
            r = c.get(
                f"{s.mtn_base_url}/collection/v1_0/requesttopay/{provider_reference}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Target-Environment": s.mtn_environment,
                    "Ocp-Apim-Subscription-Key": s.mtn_subscription_key,
                },
            )
        if r.status_code >= 400:
            raise PaymentProviderError("Could not verify with MTN", "verify_failed")
        data = r.json()
        return VerificationResult(
            status=_map_status(str(data.get("status", ""))),
            failure_reason=data.get("reason") and str(data["reason"]),
            payload={"status": data.get("status"), "financialTransactionId": data.get("financialTransactionId")},
        )

    def parse_webhook(self, headers: dict[str, str], body: bytes) -> WebhookEvent:
        self._verify_signature(self.settings.mtn_webhook_secret, headers, body, "x-fork-signature")
        import json

        data = json.loads(body or b"{}")
        return WebhookEvent(
            provider_reference=str(data.get("referenceId") or data.get("externalId") or ""),
            status=_map_status(str(data.get("status", ""))),
            failure_reason=data.get("reason") and str(data["reason"]),
            payload={"status": data.get("status")},
        )


class AirtelProvider(MobileMoneyProvider):
    """Airtel Money Collections: USSD push prompts the customer on their handset."""

    name = PaymentProviderName.AIRTEL

    def _token(self) -> str:
        s = self.settings
        if not (s.airtel_client_id and s.airtel_client_secret):
            raise PaymentProviderError("Airtel Money is not configured on this server", "not_configured")
        with self._client() as c:
            r = c.post(
                f"{s.airtel_base_url}/auth/oauth2/token",
                json={"client_id": s.airtel_client_id, "client_secret": s.airtel_client_secret, "grant_type": "client_credentials"},
            )
        if r.status_code >= 400:
            raise PaymentProviderError("Airtel authentication failed", "auth")
        return str(r.json()["access_token"])

    def initiate(self, payment_id: uuid.UUID, amount_minor: int, currency: str, payer_phone: str, note: str) -> InitiationResult:
        s = self.settings
        token = self._token()
        reference = str(payment_id)
        body = {
            "reference": note[:64],
            "subscriber": {"country": s.airtel_country, "currency": currency, "msisdn": payer_phone[-9:]},
            "transaction": {"amount": amount_minor, "country": s.airtel_country, "currency": currency, "id": reference},
        }
        with self._client() as c:
            r = c.post(
                f"{s.airtel_base_url}/merchant/v1/payments/",
                json=body,
                headers={"Authorization": f"Bearer {token}", "X-Country": s.airtel_country, "X-Currency": currency},
            )
        if r.status_code >= 400:
            raise PaymentProviderError(f"Airtel rejected the request ({r.status_code})", "rejected")
        return InitiationResult(
            provider_reference=reference,
            status=PaymentStatus.PROCESSING,
            instructions="Check your phone: Airtel will prompt you to approve the payment with your own PIN on your handset.",
        )

    def verify(self, provider_reference: str) -> VerificationResult:
        s = self.settings
        token = self._token()
        with self._client() as c:
            r = c.get(
                f"{s.airtel_base_url}/standard/v1/payments/{provider_reference}",
                headers={"Authorization": f"Bearer {token}", "X-Country": s.airtel_country, "X-Currency": s.currency},
            )
        if r.status_code >= 400:
            raise PaymentProviderError("Could not verify with Airtel", "verify_failed")
        data = r.json()
        tx = data.get("data", {}).get("transaction", {}) if isinstance(data, dict) else {}
        status = str(tx.get("status", ""))
        mapped = {"TS": PaymentStatus.SUCCESS, "TF": PaymentStatus.FAILED, "TIP": PaymentStatus.PROCESSING}.get(status, PaymentStatus.PROCESSING)
        return VerificationResult(status=mapped, failure_reason=tx.get("message") and str(tx["message"]), payload={"status": status})

    def parse_webhook(self, headers: dict[str, str], body: bytes) -> WebhookEvent:
        self._verify_signature(self.settings.airtel_webhook_secret, headers, body, "x-fork-signature")
        import json

        data = json.loads(body or b"{}")
        tx = data.get("transaction", {}) if isinstance(data, dict) else {}
        status_code = str(tx.get("status_code", tx.get("status", "")))
        mapped = {"TS": PaymentStatus.SUCCESS, "TF": PaymentStatus.FAILED}.get(status_code, PaymentStatus.PROCESSING)
        return WebhookEvent(
            provider_reference=str(tx.get("id", "")),
            status=mapped,
            failure_reason=tx.get("message") and str(tx["message"]),
            payload={"status_code": status_code},
        )


class DemoPaymentProvider(PaymentProvider):
    """Clearly-labelled sandbox. No money moves. Confirmation is explicit via /confirm-demo,
    never automatic, so nothing looks like a real payment succeeding on its own."""

    name = PaymentProviderName.DEMO
    is_demo = True

    def initiate(self, payment_id: uuid.UUID, amount_minor: int, currency: str, payer_phone: str, note: str) -> InitiationResult:
        return InitiationResult(
            provider_reference=f"demo-{payment_id}",
            status=PaymentStatus.PROCESSING,
            instructions="DEMO MODE — no money will move. Use the 'Simulate approval' or 'Simulate decline' buttons to finish this test payment.",
            payload={"demo": True},
        )

    def verify(self, provider_reference: str) -> VerificationResult:
        return VerificationResult(status=PaymentStatus.PROCESSING, payload={"demo": True})

    def parse_webhook(self, headers: dict[str, str], body: bytes) -> WebhookEvent:
        raise PaymentProviderError("Demo provider does not accept webhooks", "unsupported")


def _map_status(raw: str) -> PaymentStatus:
    raw = raw.upper()
    if raw in ("SUCCESSFUL", "SUCCESS"):
        return PaymentStatus.SUCCESS
    if raw in ("FAILED", "REJECTED"):
        return PaymentStatus.FAILED
    if raw in ("CANCELLED", "CANCELED"):
        return PaymentStatus.CANCELLED
    if raw in ("EXPIRED", "TIMEOUT"):
        return PaymentStatus.EXPIRED
    return PaymentStatus.PROCESSING


def build_provider(name: PaymentProviderName, settings: Settings) -> PaymentProvider:
    if settings.demo_mode or settings.payments_demo:
        return DemoPaymentProvider()
    if name == PaymentProviderName.MTN:
        return MTNProvider(settings)
    if name == PaymentProviderName.AIRTEL:
        return AirtelProvider(settings)
    return DemoPaymentProvider()
