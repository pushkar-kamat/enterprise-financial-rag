from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.auth import require_admin
from backend.db import get_db
from backend.models import AuditLog, User, UserRole

router = APIRouter(
    prefix="/api/admin/users",
    tags=["Admin Users"],
)


class UpdateUserRoleRequest(BaseModel):
    role: UserRole


@router.get("")
def list_users(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.scalars(
        select(User).order_by(User.created_at.desc())
    ).all()

    return {
        "users": [
            {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "is_active": user.is_active,
                "created_at": user.created_at,
            }
            for user in users
        ]
    }


@router.patch("/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: UpdateUserRoleRequest,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    target_user = db.scalar(
        select(User).where(User.id == user_id)
    )

    if target_user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    new_role = payload.role.value
    old_role = target_user.role

    if old_role == new_role:
        return {
            "message": "User role is already set to this value.",
            "user": {
                "id": target_user.id,
                "email": target_user.email,
                "name": target_user.name,
                "role": target_user.role,
                "is_active": target_user.is_active,
            },
        }

    # Prevent an administrator from removing their own admin access.
    if (
        target_user.id == current_admin.id
        and new_role != UserRole.ADMIN.value
    ):
        raise HTTPException(
            status_code=400,
            detail="You cannot remove your own administrator access.",
        )

    # Prevent the system from having zero active administrators.
    if (
        old_role == UserRole.ADMIN.value
        and new_role != UserRole.ADMIN.value
    ):
        admin_count = db.scalar(
            select(func.count(User.id)).where(
                User.role == UserRole.ADMIN.value,
                User.is_active.is_(True),
            )
        )

        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the last active administrator.",
            )

    target_user.role = new_role

    audit_log = AuditLog(
        user_id=current_admin.id,
        action="user.role.update",
        resource_type="user",
        resource_id=str(target_user.id),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    db.add(audit_log)
    db.commit()
    db.refresh(target_user)

    return {
        "message": "User role updated successfully.",
        "user": {
            "id": target_user.id,
            "email": target_user.email,
            "name": target_user.name,
            "role": target_user.role,
            "is_active": target_user.is_active,
        },
    }