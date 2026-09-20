from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.core.deps import DB, CacheDep, CurrentUser, SettingsDep, client_ip, rate_limit
from app.models import Profile, User
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenPair,
    UserOut,
    VerifyEmailRequest,
)
from app.services import auth as auth_service
from app.services.auth import AuthError

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_out(user: User) -> UserOut:
    profile: Profile | None = user.profile
    return UserOut(
        id=user.id,
        email=user.email,
        username=user.username,
        role=user.role.value,
        email_verified=user.email_verified_at is not None,
        trial_simulations_remaining=user.trial_simulations_remaining,
        referral_code=user.referral_code,
        created_at=user.created_at,
        profile=profile,  # type: ignore[arg-type]
    )


def _raise(exc: AuthError) -> None:
    raise HTTPException(exc.status_code, str(exc))


@router.post("/signup", response_model=AuthResponse, status_code=201, dependencies=[rate_limit("auth")])
def signup(req: SignupRequest, request: Request, db: DB, cache: CacheDep, settings: SettingsDep) -> AuthResponse:
    try:
        user, tokens, dev_token = auth_service.signup(db, cache, req, settings, client_ip(request), request.headers.get("user-agent"))
    except AuthError as exc:
        _raise(exc)
    return AuthResponse(user=_user_out(user), tokens=tokens, dev_verification_token=dev_token)


@router.post("/login", response_model=AuthResponse, dependencies=[rate_limit("auth")])
def login(req: LoginRequest, request: Request, db: DB, settings: SettingsDep) -> AuthResponse:
    try:
        user, tokens = auth_service.login(db, req.email, req.password, settings, client_ip(request), request.headers.get("user-agent"))
    except AuthError as exc:
        _raise(exc)
    return AuthResponse(user=_user_out(user), tokens=tokens)


@router.post("/refresh", response_model=TokenPair, dependencies=[rate_limit("auth")])
def refresh(req: RefreshRequest, request: Request, db: DB, settings: SettingsDep) -> TokenPair:
    try:
        _, tokens = auth_service.refresh(db, req.refresh_token, settings, client_ip(request), request.headers.get("user-agent"))
    except AuthError as exc:
        _raise(exc)
    return tokens


@router.post("/logout", response_model=MessageResponse)
def logout(req: RefreshRequest, db: DB, user: CurrentUser) -> MessageResponse:
    auth_service.logout(db, req.refresh_token, user)
    return MessageResponse(message="Signed out")


@router.post("/logout-all", response_model=MessageResponse)
def logout_all(db: DB, user: CurrentUser) -> MessageResponse:
    n = auth_service.logout_all(db, user)
    return MessageResponse(message=f"Signed out of {n} session(s)")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return _user_out(user)


@router.post("/forgot-password", response_model=MessageResponse, dependencies=[rate_limit("auth")])
def forgot_password(req: ForgotPasswordRequest, db: DB, cache: CacheDep, settings: SettingsDep) -> MessageResponse:
    token = auth_service.start_password_reset(db, cache, req.email, settings)
    return MessageResponse(message="If that email exists, a reset link has been sent.", dev_token=token)


@router.post("/reset-password", response_model=MessageResponse, dependencies=[rate_limit("auth")])
def reset_password(req: ResetPasswordRequest, db: DB, cache: CacheDep) -> MessageResponse:
    try:
        auth_service.complete_password_reset(db, cache, req.token, req.new_password)
    except AuthError as exc:
        _raise(exc)
    return MessageResponse(message="Password updated. Please sign in again.")


@router.post("/change-password", response_model=MessageResponse)
def change_password(req: ChangePasswordRequest, db: DB, user: CurrentUser) -> MessageResponse:
    try:
        auth_service.change_password(db, user, req.current_password, req.new_password)
    except AuthError as exc:
        _raise(exc)
    return MessageResponse(message="Password changed")


@router.post("/send-verification", response_model=MessageResponse, dependencies=[rate_limit("auth")])
def send_verification(cache: CacheDep, user: CurrentUser, settings: SettingsDep) -> MessageResponse:
    if user.email_verified_at is not None:
        return MessageResponse(message="Email already verified")
    token = auth_service.start_email_verification(cache, user, settings)
    return MessageResponse(message="Verification email sent.", dev_token=token)


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(req: VerifyEmailRequest, db: DB, cache: CacheDep) -> MessageResponse:
    try:
        auth_service.complete_email_verification(db, cache, req.token)
    except AuthError as exc:
        _raise(exc)
    return MessageResponse(message="Email verified")
