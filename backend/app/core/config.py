"""Environment-driven configuration. Secrets live only here — never in the frontend."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

AIProviderName = Literal["demo", "groq", "gemini", "openai"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "FORK"
    app_version: str = "0.2.0"
    app_env: Literal["development", "test", "production"] = "development"
    demo_mode: bool = True
    debug: bool = False
    log_level: str = "INFO"
    frontend_url: str = "http://localhost:5173"
    public_api_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:5173,http://localhost:4173,http://localhost:8080"

    database_url: str = "postgresql+psycopg://fork:fork@localhost:5432/fork"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = Field(default="change-me-in-production-please", min_length=16)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 30
    reset_token_minutes: int = 30
    verify_token_hours: int = 48

    rate_limit_per_minute: int = 120
    auth_rate_limit_per_minute: int = 10

    # AI — Gemini free tier is the default; OpenAI is optional. Any provider that is
    # unconfigured or failing falls back to deterministic demo responses.
    ai_provider: AIProviderName = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    ai_timeout_seconds: float = 25.0
    ai_cache_seconds: int = 6 * 3600

    # Usage / plans
    trial_simulations: int = 5
    free_daily_simulations: int = 3
    weekly_price_ugx: int = 3000
    pro_monthly_price_ugx: int = 10000
    currency: str = "UGX"

    # Payments — merchant numbers are backend-only and never sent to the browser.
    # payments_demo forces the clearly-labelled sandbox provider even when demo_mode is off.
    payments_demo: bool = True
    mtn_merchant_number: str = ""
    mtn_api_user: str = ""
    mtn_api_key: str = ""
    mtn_subscription_key: str = ""
    mtn_base_url: str = "https://sandbox.momodeveloper.mtn.com"
    mtn_environment: str = "sandbox"
    airtel_merchant_number: str = ""
    airtel_client_id: str = ""
    airtel_client_secret: str = ""
    airtel_base_url: str = "https://openapiuat.airtel.africa"
    airtel_country: str = "UG"
    mtn_webhook_secret: str = ""
    airtel_webhook_secret: str = ""
    payment_expiry_minutes: int = 15

    # Media
    media_backend: Literal["local", "s3"] = "local"
    media_local_dir: str = "media"
    media_max_bytes: int = 25 * 1024 * 1024
    s3_bucket: str = ""
    s3_region: str = ""
    s3_endpoint_url: str = ""

    # WebRTC
    turn_server_url: str = ""
    turn_username: str = ""
    turn_password: str = ""
    stun_server_url: str = "stun:stun.l.google.com:19302"

    terms_version: str = "2026-01"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_dev(self) -> bool:
        return not self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()
