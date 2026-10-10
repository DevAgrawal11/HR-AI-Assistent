
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
from database import Base, get_db
from models import Application, Candidate, JobOpening, User


def setup_manual_screening_test():
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

    user = User(
        email="manual-screening-test@example.com",
        password_hash="not-used",
        role="HR",
    )
    db.add(user)
    db.flush()

    job = JobOpening(
        title="Manual Screening Test",
        description="Test description",
        status="Open",
        requirements_confirmed=True,
        created_by_id=user.id,
    )
    db.add(job)
    db.flush()

    candidate = Candidate(
        name="Manual Screening Candidate",
        email="manual-screening-candidate@example.com",
    )
    db.add(candidate)
    db.flush()

    application = Application(
        job_id=job.id,
        candidate_id=candidate.id,
        resume_filename="test.pdf",
        screening_status="Queued",
        stage="New",
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    def override_get_db():
        yield db

    main.app.dependency_overrides[get_db] = override_get_db
    main.app.dependency_overrides[
        main.get_current_user_from_cookie
    ] = lambda: {"role": "HR"}

    return engine, db, application.id


def cleanup_manual_screening_test(engine, db):
    main.app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.mark.parametrize(
    ("failure", "expected_status"),
    [
        (ValueError("Requirements are not confirmed"), 400),
        (RuntimeError("Screening service unavailable"), 503),
        (Exception("Unexpected screening error"), 500),
    ],
)
def test_manual_screening_failure_sets_failed_status(
    failure, expected_status, monkeypatch
):
    engine, db, application_id = setup_manual_screening_test()

    try:
        def raise_screening_error(*args, **kwargs):
            raise failure

        monkeypatch.setattr(
            main,
            "screen_application",
            raise_screening_error,
        )

        with TestClient(main.app) as client:
            response = client.post(
                f"/api/v1/applications/{application_id}/screen"
            )

        assert response.status_code == expected_status

        db.expire_all()
        application = db.get(Application, application_id)
        assert application.screening_status == "Failed"

    finally:
        cleanup_manual_screening_test(engine, db)
