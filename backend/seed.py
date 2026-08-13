"""Seed an admin (or regular) user into the database.

Usage:
    python seed.py                          # creates admin@gmail.com / Password@2026
    python seed.py --email x@y.com --password Secret123! --role admin --name "LCH Admin"
"""

import argparse

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.enums import AuthProvider, UserRole, UserStatus
from app.models.user import User


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a user into LCH.")
    parser.add_argument("--email", default="admin@gmail.com")
    parser.add_argument("--password", default="Password@2026")
    parser.add_argument("--role", default="admin", choices=["admin", "user"])
    parser.add_argument("--name", default="LCH Admin", help="'First Last' name.")
    args = parser.parse_args()

    first_name, _, last_name = args.name.partition(" ")
    if not last_name:
        first_name, last_name = args.name, args.name

    role = UserRole.ADMIN if args.role == "admin" else UserRole.USER
    roles = [UserRole.ADMIN, UserRole.USER] if role == UserRole.ADMIN else [UserRole.USER]

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).one_or_none()
        if user is not None:
            user.first_name = first_name
            user.last_name = last_name
            user.password = hash_password(args.password)
            user.role = role
            user.roles = roles
            user.status = UserStatus.ACTIVE
            user.provider = AuthProvider.CREDENTIALS
            user.is_active = True
            db.flush()
            print(f"Updated existing user: {args.email} (role={role.value})")
        else:
            db.add(
                User(
                    first_name=first_name,
                    last_name=last_name,
                    email=args.email,
                    password=hash_password(args.password),
                    role=role,
                    roles=roles,
                    status=UserStatus.ACTIVE,
                    provider=AuthProvider.CREDENTIALS,
                    is_active=True,
                    is_verified=True,
                )
            )
            print(f"Created user: {args.email} (role={role.value})")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()