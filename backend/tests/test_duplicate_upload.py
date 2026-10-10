
import os
import tempfile
from pathlib import Path

# Configure a separate SQLite database before importing the app.
_test_db_dir = tempfile.mkdtemp(prefix="hr_ai_tests_")
os.environ["DATABASE_URL"] = (
    f"sqlite:///{Path(_test_db_dir) / 'test.db'}"
)

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
from database import Base, get_db
from models import Application, Candidate, JobOpening


def make_test_database():
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
    return engine, TestingSession


def test_duplicate_resume_is_rejected_without_creating_application(
    tmp_path, monkeypatch
):
    engine, TestingSession = make_test_database()
    db = TestingSession()

    try:
        job = JobOpening(
            title="Test Job",
            description="Test description",
            status="Open",
            requirements_confirmed=True,
            created_by_id=1,
        )

        # Create the required user and job in the isolated database.
        from models import User

        user = User(
            email="hr-test@example.com",
            password_hash="not-used",
            role="HR",
        )
        db.add(user)
        db.flush()
        job.created_by_id = user.id
        db.add(job)
        db.flush()

        candidate = Candidate(
            name="Existing Candidate",
            email="existing@example.com",
        )
        db.add(candidate)
        db.flush()

        application = Application(
            job_id=job.id,
            candidate_id=candidate.id,
            resume_filename="existing.pdf",
            screening_status="Queued",
            stage="New",
        )
        db.add(application)
        db.commit()
        db.refresh(application)

        resume_bytes = b"%PDF-1.4 test resume content"
        existing_file = tmp_path / f"application_{application.id}.pdf"
        existing_file.write_bytes(resume_bytes)

        monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)
        monkeypatch.setattr(
            main,
            "process_resume_background",
            lambda application_id: None,
        )

        def override_get_db():
            try:
                yield db
            finally:
                pass

        main.app.dependency_overrides[get_db] = override_get_db
        main.app.dependency_overrides[
            main.get_current_user_from_cookie
        ] = lambda: {"role": "HR"}

        with TestClient(main.app) as client:
            response = client.post(
                f"/api/v1/jobs/{job.id}/applications",
                data={
                    "candidate_name": "Duplicate Candidate",
                    "candidate_email": "duplicate@example.com",
                },
                files={
                    "resume": (
                        "duplicate.pdf",
                        resume_bytes,
                        "application/pdf",
                    )
                },
            )

        assert response.status_code == 409
        assert "identical resume" in response.text.lower()

        assert (
            db.query(Application).filter(
                Application.job_id == job.id
            ).count()
            == 1
        )
        assert db.query(Candidate).count() == 1

    finally:
        main.app.dependency_overrides.clear()
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_different_resume_content_is_not_flagged_as_duplicate(
    tmp_path, monkeypatch
):
    engine, TestingSession = make_test_database()
    db = TestingSession()

    try:
        from models import User

        user = User(
            email="hr-different-test@example.com",
            password_hash="not-used",
            role="HR",
        )
        db.add(user)
        db.flush()

        job = JobOpening(
            title="Test Job",
            description="Test description",
            status="Open",
            requirements_confirmed=True,
            created_by_id=user.id,
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)
        monkeypatch.setattr(
            main,
            "process_resume_background",
            lambda application_id: None,
        )

        def override_get_db():
            try:
                yield db
            finally:
                pass

        main.app.dependency_overrides[get_db] = override_get_db
        main.app.dependency_overrides[
            main.get_current_user_from_cookie
        ] = lambda: {"role": "HR"}

        with TestClient(main.app) as client:
            response = client.post(
                f"/api/v1/jobs/{job.id}/applications",
                data={
                    "candidate_name": "New Candidate",
                    "candidate_email": "new@example.com",
                },
                files={
                    "resume": (
                        "new.pdf",
                        b"%PDF-1.4 completely different content",
                        "application/pdf",
                    )
                },
            )

        assert response.status_code == 202
        assert response.json()["screening_status"] == "Queued"
        assert db.query(Application).filter(
            Application.job_id == job.id
        ).count() == 1

    finally:
        main.app.dependency_overrides.clear()
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
