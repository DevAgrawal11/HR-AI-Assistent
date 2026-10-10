
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
from database import Base
from models import Application, ApplicationEvent, Candidate, JobOpening, User


def test_missing_resume_sets_failed_status_and_records_event(
    tmp_path, monkeypatch
):
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

    try:
        user = User(
            email="screening-failure-test@example.com",
            password_hash="not-used",
            role="HR",
        )
        db.add(user)
        db.flush()

        job = JobOpening(
            title="Screening Failure Test",
            description="Test description",
            status="Open",
            requirements_confirmed=True,
            created_by_id=user.id,
        )
        db.add(job)
        db.flush()

        candidate = Candidate(
            name="Failure Test Candidate",
            email="failure-candidate@example.com",
        )
        db.add(candidate)
        db.flush()

        application = Application(
            job_id=job.id,
            candidate_id=candidate.id,
            resume_filename="missing.pdf",
            screening_status="Queued",
            stage="New",
        )
        db.add(application)
        db.commit()
        db.refresh(application)

        monkeypatch.setattr(main, "SessionLocal", TestingSession)
        monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)

        # Ensure the resume file is absent.
        resume_path = (
            Path(tmp_path) / f"application_{application.id}.pdf"
        )
        assert not resume_path.exists()

        application_id = application.id

        # Run the background task synchronously.
        main.process_resume_background(application_id)

        db.expire_all()
        updated_application = db.get(Application, application_id)

        assert updated_application.screening_status == "Failed"

        events = (
            db.query(ApplicationEvent)
            .filter(
                ApplicationEvent.application_id == application_id,
                ApplicationEvent.event_type == "screening_failed",
            )
            .all()
        )

        assert len(events) == 1
        assert "Stored resume file not found" in events[0].description

    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
