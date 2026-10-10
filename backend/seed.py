from database import Base, SessionLocal, engine
from models import User
from auth import hash_password


Base.metadata.create_all(bind=engine)


def seed_users():
    db = SessionLocal()

    try:
        existing_users = db.query(User).count()

        if existing_users > 0:
            print("Users already exist.")
            return

        hr_user = User(
            email="hr@example.com",
            password_hash=hash_password("HR@123456"),
            role="HR",
        )

        viewer_user = User(
            email="viewer@example.com",
            password_hash=hash_password("Viewer@123456"),
            role="Viewer",
        )

        db.add_all([hr_user, viewer_user])
        db.commit()

        print("Seed users created successfully.")
        print("HR: hr@example.com / HR@123456")
        print("Viewer: viewer@example.com / Viewer@123456")

    finally:
        db.close()


if __name__ == "__main__":
    seed_users()