
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
from database import Base, get_db
from models import Application, Candidate, JobOpening, User


DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument."
    "wordprocessingml.document"
)


def setup_upload_test(role="HR", requirements_confirmed=True):
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
            email=f"{role.lower()}-upload-test@example.com",
            password_hash="not-used",
            role=role,
        )
        db.add(user)
        db.flush()

        job = JobOpening(
            title="Upload Validation Test Job",
            description="Test description",
            status="Open",
            requirements_confirmed=requirements_confirmed,
            created_by_id=user.id,
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        def override_get_db():
            yield db

        main.app.dependency_overrides[get_db] = override_get_db
        main.app.dependency_overrides[
            main.get_current_user_from_cookie
        ] = lambda: {"role": role}

        return engine, db, job.id

    except Exception:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        raise


def cleanup_upload_test(engine, db):
    main.app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def upload_file(client, job_id, filename, content, content_type):
    return client.post(
        f"/api/v1/jobs/{job_id}/applications",
        params={
            "candidate_name": "Validation Candidate",
            "candidate_email": "validation@example.com",
        },
        files={
            "resume": (filename, content, content_type),
        },
    )


def test_rejects_unsupported_file_extension(tmp_path, monkeypatch):
    engine, db, job_id = setup_upload_test()

    try:
        monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)

        with TestClient(main.app) as client:
            response = upload_file(
                client,
                job_id,
                "resume.txt",
                b"Some resume text",
                "text/plain",
            )

        assert response.status_code == 400
        assert "Only PDF and DOCX" in response.text
        assert db.query(Application).count() == 0
        assert db.query(Candidate).count() == 0

    finally:
        cleanup_upload_test(engine, db)


def test_rejects_mismatched_mime_type(tmp_path, monkeypatch):
    engine, db, job_id = setup_upload_test()

    try:
        monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)

        with TestClient(main.app) as client:
            response = upload_file(
                client,
                job_id,
                "resume.pdf",
                b"%PDF-1.4 test content",
                "text/plain",
            )

        assert response.status_code == 400
        assert "does not match" in response.text
        assert db.query(Application).count() == 0

    finally:
        cleanup_upload_test(engine, db)


def test_rejects_empty_file(tmp_path, monkeypatch):
    engine, db, job_id = setup_upload_test()

    try:
        monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)

        with TestClient(main.app) as client:
            response = upload_file(
                client,
                job_id,
                "empty.pdf",
                b"",
                "application/pdf",
            )

        assert response.status_code == 400
        assert "empty" in response.text.lower()
        assert db.query(Application).count() == 0

    finally:
        cleanup_upload_test(engine, db)


def test_rejects_file_larger_than_5_mb(tmp_path, monkeypatch):
    engine, db, job_id = setup_upload_test()

    try:
        monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)

        oversized_content = b"%PDF-" + b"A" * (5 * 1024 * 1024)

        with TestClient(main.app) as client:
            response = upload_file(
                client,
                job_id,
                "oversized.pdf",
                oversized_content,
                "application/pdf",
            )

        assert response.status_code == 413
        assert "5 MB or smaller" in response.text
        assert db.query(Application).count() == 0

    finally:
        cleanup_upload_test(engine, db)


def test_rejects_invalid_pdf_signature(tmp_path, monkeypatch):
    engine, db, job_id = setup_upload_test()

    try:
        monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)

        with TestClient(main.app) as client:
            response = upload_file(
                client,
                job_id,
                "fake.pdf",
                b"This is not a PDF file",
                "application/pdf",
            )

        assert response.status_code == 400
        assert "not a valid PDF" in response.text
        assert db.query(Application).count() == 0

    finally:
        cleanup_upload_test(engine, db)


def test_viewer_cannot_upload_resume(tmp_path, monkeypatch):
    engine, db, job_id = setup_upload_test(role="Viewer")

    try:
        monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)

        with TestClient(main.app) as client:
            response = upload_file(
                client,
                job_id,
                "resume.pdf",
                b"%PDF-1.4 test content",
                "application/pdf",
            )

        assert response.status_code == 403
        assert "Only HR users" in response.text
        assert db.query(Application).count() == 0
        assert db.query(Candidate).count() == 0

    finally:
        cleanup_upload_test(engine, db)

import io
import zipfile


def make_minimal_docx():
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w") as docx:
        docx.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/'
            'package/2006/content-types"></Types>',
        )
        docx.writestr(
            "word/document.xml",
            '<?xml version="1.0"?>'
            '<document xmlns="http://schemas.openxmlformats.org/'
            'wordprocessingml/2006/main"></document>',
        )

    return buffer.getvalue()


def test_rejects_invalid_docx_signature(tmp_path, monkeypatch):
    engine, db, job_id = setup_upload_test()

    try:
        monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)

        with TestClient(main.app) as client:
            response = upload_file(
                client,
                job_id,
                "fake.docx",
                b"This is not a DOCX file",
                DOCX_MIME,
            )

        assert response.status_code == 400
        assert "not a valid DOCX" in response.text
        assert db.query(Application).count() == 0

    finally:
        cleanup_upload_test(engine, db)


def test_accepts_docx_with_expected_signature(tmp_path, monkeypatch):
    engine, db, job_id = setup_upload_test()

    try:
        monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)
        monkeypatch.setattr(
            main,
            "process_resume_background",
            lambda application_id: None,
        )

        docx_content = make_minimal_docx()

        with TestClient(main.app) as client:
            response = upload_file(
                client,
                job_id,
                "valid.docx",
                docx_content,
                DOCX_MIME,
            )

        assert response.status_code == 202
        assert db.query(Application).count() == 1

        application = db.query(Application).one()
        saved_file = tmp_path / f"application_{application.id}.docx"

        assert saved_file.exists()
        assert saved_file.read_bytes() == docx_content

    finally:
        cleanup_upload_test(engine, db)
