
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
from database import Base, get_db
from models import Application, ApplicationEvent, Candidate, JobOpening, User


def setup_test_app(role="HR"):
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
        email=f"{role.lower()}-stage-test@example.com",
        password_hash="not-used",
        role=role,
    )
    db.add(user)
    db.flush()

    job = JobOpening(
        title="Stage History Test Job",
        description="Test description",
        status="Open",
        requirements_confirmed=True,
        created_by_id=user.id,
    )
    db.add(job)
    db.flush()

    candidate = Candidate(
        name="Test Candidate",
        email="candidate-stage-test@example.com",
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
        try:
            yield db
        finally:
            pass

    main.app.dependency_overrides[get_db] = override_get_db
    main.app.dependency_overrides[
        main.get_current_user_from_cookie
    ] = lambda: {"role": role}

    return engine, db, application.id


def cleanup_test_app(engine, db):
    main.app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_stage_change_creates_history_event():
    engine, db, application_id = setup_test_app()

    try:
        with TestClient(main.app) as client:
            response = client.patch(
                f"/api/v1/applications/{application_id}/stage",
                json={
                    "stage": "Shortlisted",
                    "reason": "Meets the initial requirements",
                },
            )

        assert response.status_code == 200
        assert response.json()["stage"] == "Shortlisted"
        assert (
            response.json()["stage_reason"]
            == "Meets the initial requirements"
        )

        event = (
            db.query(ApplicationEvent)
            .filter(
                ApplicationEvent.application_id == application_id
            )
            .one()
        )
        assert event.event_type == "Stage Changed"
        assert "New to Shortlisted" in event.description
        assert "Meets the initial requirements" in event.description

    finally:
        cleanup_test_app(engine, db)


def test_reason_only_update_creates_history_event():
    engine, db, application_id = setup_test_app()

    try:
        with TestClient(main.app) as client:
            response = client.patch(
                f"/api/v1/applications/{application_id}/stage",
                json={
                    "stage": "New",
                    "reason": "Waiting for HR review",
                },
            )

        assert response.status_code == 200
        assert response.json()["stage"] == "New"
        assert (
            response.json()["stage_reason"]
            == "Waiting for HR review"
        )

        event = (
            db.query(ApplicationEvent)
            .filter(
                ApplicationEvent.application_id == application_id
            )
            .one()
        )
        assert event.event_type == "Decision Reason Updated"
        assert "Waiting for HR review" in event.description

    finally:
        cleanup_test_app(engine, db)


def test_invalid_stage_is_rejected():
    engine, db, application_id = setup_test_app()

    try:
        with TestClient(main.app) as client:
            response = client.patch(
                f"/api/v1/applications/{application_id}/stage",
                json={"stage": "Offer"},
            )

        assert response.status_code == 422

        application = db.get(Application, application_id)
        assert application.stage == "New"
        assert db.query(ApplicationEvent).count() == 0

    finally:
        cleanup_test_app(engine, db)


def test_viewer_cannot_change_stage():
    engine, db, application_id = setup_test_app(role="Viewer")

    try:
        with TestClient(main.app) as client:
            response = client.patch(
                f"/api/v1/applications/{application_id}/stage",
                json={
                    "stage": "Shortlisted",
                    "reason": "Viewer permission test",
                },
            )

        assert response.status_code == 403

        application = db.get(Application, application_id)
        assert application.stage == "New"
        assert db.query(ApplicationEvent).count() == 0

    finally:
        cleanup_test_app(engine, db)
