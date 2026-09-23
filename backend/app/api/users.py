from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import DB, CurrentUser
from app.models import Profile, User, Visibility
from app.schemas.auth import ProfileOut, ProfileUpdate

router = APIRouter(tags=["users"])


class PublicProfile(BaseModel):
    username: str
    display_name: str
    bio: str
    avatar_url: str | None
    location: str | None
    interests: list[str]
    skills: list[str]


def _own_profile(db: DB, user: User) -> Profile:
    profile = user.profile
    if profile is None:
        profile = Profile(user_id=user.id, display_name=user.username)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("/api/profiles/me", response_model=ProfileOut)
def my_profile(db: DB, user: CurrentUser) -> Profile:
    return _own_profile(db, user)


@router.patch("/api/profiles/me", response_model=ProfileOut)
def update_profile(req: ProfileUpdate, db: DB, user: CurrentUser) -> Profile:
    profile = _own_profile(db, user)
    data = req.model_dump(exclude_none=True)
    if "visibility" in data:
        data["visibility"] = Visibility(data["visibility"])
    for key, value in data.items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/api/users/{username}", response_model=PublicProfile)
def public_profile(username: str, db: DB, viewer: CurrentUser) -> PublicProfile:
    user = db.scalar(select(User).where(User.username == username.lower(), User.deleted_at.is_(None), User.is_active))
    if user is None or user.profile is None:
        raise HTTPException(404, "User not found")
    p = user.profile
    if p.visibility == Visibility.PRIVATE and user.id != viewer.id:
        raise HTTPException(404, "User not found")
    return PublicProfile(
        username=user.username,
        display_name=p.display_name,
        bio=p.bio,
        avatar_url=p.avatar_url,
        location=p.location,
        interests=p.interests,
        skills=p.skills,
    )


@router.delete("/api/users/me", status_code=204)
def delete_account(db: DB, user: CurrentUser) -> None:
    from app.db.base import utcnow

    user.deleted_at = utcnow()
    user.is_active = False
    db.commit()
