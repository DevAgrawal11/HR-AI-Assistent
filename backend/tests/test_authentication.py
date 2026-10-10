
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
from auth import hash_password
from database import Base, get_db
from models import User


def setup_auth_test():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)

    TestingSession = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )
    db = TestingSession()

    password = "TestPassword@123"
    user = User(
        email="auth-test@example.com",
        password_hash=hash_password(password),
        role="HR",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    def override_get_db():
        yield db

    main.app.dependency_overrides[get_db] = override_get_db

    return engine, db, user.id, password


def cleanup_auth_test(engine, db):
    main.app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_valid_login_sets_http_only_cookie():
    engine, db, user_id, password = setup_auth_test()

    try:
        with TestClient(main.app) as client:
            response = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "auth-test@example.com",
                    "password": password,
                },
            )

        assert response.status_code == 200
        assert response.json()["id"] == user_id
        assert response.json()["role"] == "HR"

        cookie = response.cookies.get("access_token")
        assert cookie is not None
        assert "httponly" in response.headers.get(
            "set-cookie", ""
        ).lower()

    finally:
        cleanup_auth_test(engine, db)


def test_invalid_password_is_rejected():
    engine, db, _, _ = setup_auth_test()

    try:
        with TestClient(main.app) as client:
            response = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "auth-test@example.com",
                    "password": "WrongPassword@123",
                },
            )

        assert response.status_code == 401
        assert "Invalid email or password" in response.text
        assert "access_token" not in response.cookies

    finally:
        cleanup_auth_test(engine, db)


def test_protected_endpoint_rejects_missing_cookie():
    engine, db, _, _ = setup_auth_test()

    try:
        with TestClient(main.app) as client:
            response = client.get("/api/v1/auth/me")

        assert response.status_code == 401

    finally:
        cleanup_auth_test(engine, db)


def test_authenticated_user_can_access_auth_me():
    engine, db, user_id, password = setup_auth_test()

    try:
        with TestClient(main.app) as client:
            login_response = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "auth-test@example.com",
                    "password": password,
                },
            )

            assert login_response.status_code == 200

            response = client.get("/api/v1/auth/me")

        assert response.status_code == 200
        assert response.json()["id"] == user_id
        assert response.json()["email"] == "auth-test@example.com"
        assert response.json()["role"] == "HR"

    finally:
        cleanup_auth_test(engine, db)
