from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, billing, decisions, misc, users
from app.core.config import get_settings
from app.core.deps import rate_limit
from app.db.session import get_sessionmaker
from app.services.subscriptions import ensure_default_plans, expire_subscriptions

log = logging.getLogger("fork")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level)
    if settings.demo_mode:
        log.info("DEMO_MODE on: deterministic AI, sandbox payments")
    elif not settings.gemini_api_key and settings.ai_provider == "gemini":
        log.warning("GEMINI_API_KEY not set — AI falls back to deterministic demo responses")
    try:
        with get_sessionmaker()() as db:
            ensure_default_plans(db, settings)
            expire_subscriptions(db)
    except Exception as exc:  # noqa: BLE001
        log.warning("Startup DB tasks skipped (%s). Run `alembic upgrade head`.", exc.__class__.__name__)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="FORK API",
        version=settings.app_version,
        description="Don't just make a decision. See where it leads.",
        lifespan=lifespan,
        docs_url="/docs" if settings.is_dev else None,
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()")
        if settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        return response

    for r in (misc.router, auth.router, users.router, decisions.router, billing.router):
        app.include_router(r, dependencies=[rate_limit("global")])
    return app


app = create_app()
