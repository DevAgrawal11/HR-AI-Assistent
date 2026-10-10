import os
import shutil
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from hashlib import sha256
from resume_parser import extract_text
import json
import logging
from gemini_service import extract_resume_profile
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session
from auth import (
    create_access_token,
    get_current_user_from_cookie,
    verify_password,
)
from database import Base, SessionLocal, get_db, engine
from schemas import (
    JobCreate,
    JobResponse,
    JobStatusUpdate,
    JobUpdate,
    LoginRequest,
    RequirementCreate,
    RequirementResponse,
    RequirementUpdate,
    UserResponse,
    ApplicationStageUpdate,
)
from screening_service import screen_application
from models import (
    Application,
    ApplicationEvent,
    Candidate,
    JobOpening,
    Requirement,
    ScreeningResult,
    User,
)
from datetime import datetime
Base.metadata.create_all(bind=engine)
logger = logging.getLogger(__name__)
app = FastAPI(
    title="HR AI Assistant API",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://hr-ai-assistant-frontend.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads" / "resumes"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def invalidate_job_screenings(db: Session, job_id: int) -> None:
    """
    Clear screening outputs for a job after its requirements change.
    The applications remain available, but must be screened again after
    HR confirms the updated requirements.
    """
    application_ids = (
        db.query(Application.id)
        .filter(Application.job_id == job_id)
        .subquery()
    )

    db.query(ScreeningResult).filter(
        ScreeningResult.application_id.in_(application_ids)
    ).delete(synchronize_session=False)

    db.query(Application).filter(
        Application.job_id == job_id
    ).update(
        {
            Application.score: None,
            Application.verdict: None,
            Application.screening_status: "Queued",
            Application.missing_must_haves: None,
        },
        synchronize_session=False,
    )


def safe_json_loads(value, default=None):
    """Decode stored JSON safely, returning a fallback for invalid values."""
    if default is None:
        default = []
    if not value:
        return default
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Invalid JSON found in a stored application field")
        return default


def process_resume_background(application_id: int) -> None:
    """Extract and screen a saved resume using an independent DB session."""
    db = SessionLocal()

    try:
        application = (
            db.query(Application)
            .filter(Application.id == application_id)
            .first()
        )
        if not application:
            logger.error(
                "Application %s not found in background task",
                application_id,
            )
            return

        application.screening_status = "Processing"
        db.commit()

        file_extension = Path(application.resume_filename).suffix.lower()
        resume_path = UPLOAD_DIR / f"application_{application.id}{file_extension}"
        if not resume_path.is_file():
            raise FileNotFoundError("Stored resume file not found")

        resume_text = extract_text(resume_path)
        if not resume_text or not resume_text.strip():
            raise ValueError("No text could be extracted from the resume")

        profile = extract_resume_profile(resume_text)
        application.resume_text = resume_text
        application.resume_profile = profile.model_dump_json()
        db.commit()

        # Screening checks that job requirements have been confirmed.
        screen_application(application_id, db)

        application = (
            db.query(Application)
            .filter(Application.id == application_id)
            .first()
        )
        if application:
            application.screening_status = "Done"
            db.commit()

    except Exception as exc:
        db.rollback()
        logger.exception(
            "Background resume processing failed for application_id=%s",
            application_id,
        )
        try:
            application = (
                db.query(Application)
                .filter(Application.id == application_id)
                .first()
            )
            if application:
                application.screening_status = "Failed"
                db.add(
                    ApplicationEvent(
                        application_id=application_id,
                        event_type="screening_failed",
                        description=f"Resume processing failed: {str(exc)[:500]}",
                    )
                )
                db.commit()
        except Exception:
            db.rollback()
            logger.exception(
                "Could not persist failure status for application_id=%s",
                application_id,
            )
    finally:
        db.close()
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "hr-ai-assistant",
    }

@app.post("/api/v1/auth/login", response_model=UserResponse)
def login(
    login_data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == login_data.email)
        .first()
    )
    if not user or not verify_password(
        login_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token = create_access_token(
        user_id=user.id,
        role=user.role,
    )
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=os.getenv("ENVIRONMENT") == "production",
        samesite="none",
        max_age=8 * 60 * 60,
    )
    return user

@app.get("/api/v1/auth/me", response_model=UserResponse)
def get_current_user(
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    user_id = int(token_data["sub"])

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


@app.get("/api/v1/auth/me", response_model=UserResponse)
def get_current_user(
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    user_id = int(token_data["sub"])
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


@app.post("/api/v1/auth/logout")
def logout(response: Response):
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
    )
    return {
        "message": "Logged out successfully",
    }

@app.post("/api/v1/jobs", response_model=JobResponse)
def create_job(
    job_data: JobCreate,
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    if token_data["role"] != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can create jobs",
        )
    job = JobOpening(
        title=job_data.title,
        description=job_data.description,
        status=job_data.status,
        created_by_id=int(token_data["sub"]),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

@app.get("/api/v1/jobs", response_model=list[JobResponse])
def get_jobs(
    current_user: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    jobs = (
        db.query(JobOpening)
        .filter(JobOpening.deleted_at.is_(None))
        .order_by(JobOpening.created_at.desc())
        .all()
    )
    return jobs
@app.get("/api/v1/jobs/{job_id}", response_model=JobResponse)
def get_job(
    job_id: int,
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    job = (
    db.query(JobOpening)
    .filter(
        JobOpening.id == job_id,
        JobOpening.deleted_at.is_(None),
    )
    .first()
)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    return job
@app.patch("/api/v1/jobs/{job_id}/status", response_model=JobResponse)
def update_job_status(
    job_id: int,
    payload: JobStatusUpdate,
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    if token_data.get("role") != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can update job status",
        )

    job = db.query(JobOpening).filter(JobOpening.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    job.status = payload.status
    try:
        db.commit()
        db.refresh(job)
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to update status for job_id=%s", job_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update job status",
        ) from exc
    return job


@app.post(
    "/api/v1/jobs/{job_id}/requirements",
    response_model=RequirementResponse,
)
def create_requirement(
    job_id: int,
    requirement_data: RequirementCreate,
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    if token_data["role"] != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can add requirements",
        )
    job = (
        db.query(JobOpening)
        .filter(JobOpening.id == job_id)
        .first()
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    last_requirement = (
        db.query(Requirement)
        .filter(Requirement.job_id == job_id)
        .order_by(Requirement.sort_order.desc())
        .first()
    )
    next_sort_order = (
        last_requirement.sort_order + 1
        if last_requirement
        else 1
    )
    requirement = Requirement(
        job_id=job_id,
        text=requirement_data.text,
        requirement_type=requirement_data.requirement_type,
        weight=requirement_data.weight,
        sort_order=next_sort_order,
    )
    db.add(requirement)
    job.requirements_confirmed = False
    invalidate_job_screenings(db, job_id)
    db.commit()
    db.refresh(requirement)
    return requirement
@app.get(
    "/api/v1/jobs/{job_id}/requirements",
    response_model=list[RequirementResponse],
)
def get_requirements(
    job_id: int,
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    job = (
        db.query(JobOpening)
        .filter(JobOpening.id == job_id)
        .first()
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    requirements = (
        db.query(Requirement)
        .filter(Requirement.job_id == job_id)
        .order_by(Requirement.sort_order.asc())
        .all()
    )
    return requirements
@app.put(
    "/api/v1/requirements/{requirement_id}",
    response_model=RequirementResponse,
)
def update_requirement(
    requirement_id: int,
    requirement_data: RequirementUpdate,
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    if token_data["role"] != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can edit requirements",
        )
    requirement = (
        db.query(Requirement)
        .filter(Requirement.id == requirement_id)
        .first()
    )
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found",
        )
    requirement.text = requirement_data.text
    requirement.requirement_type = requirement_data.requirement_type
    requirement.weight = requirement_data.weight
    job = db.query(JobOpening).filter(
        JobOpening.id == requirement.job_id
    ).first()
    if job:
        job.requirements_confirmed = False
        invalidate_job_screenings(db, job.id)
    db.commit()
    db.refresh(requirement)
    return requirement
@app.delete("/api/v1/requirements/{requirement_id}")
def delete_requirement(
    requirement_id: int,
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    if token_data["role"] != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can delete requirements",
        )
    requirement = (
        db.query(Requirement)
        .filter(Requirement.id == requirement_id)
        .first()
    )
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found",
        )
    job = db.query(JobOpening).filter(
        JobOpening.id == requirement.job_id
    ).first()
    if job:
        job.requirements_confirmed = False
        invalidate_job_screenings(db, job.id)
    db.delete(requirement)
    db.commit()
    return {
        "message": "Requirement deleted successfully",
        "requirement_id": requirement_id,
    }
@app.post("/api/v1/jobs/{job_id}/requirements/confirm")
def confirm_requirements(
    job_id: int,
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    if token_data["role"] != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can confirm requirements",
        )
    job = (
        db.query(JobOpening)
        .filter(JobOpening.id == job_id)
        .first()
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    requirements = (
        db.query(Requirement)
        .filter(Requirement.job_id == job_id)
        .all()
    )
    if not requirements:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one requirement is needed before confirmation",
        )
    job.requirements_confirmed = True
    db.commit()
    return {
        "message": "Requirements confirmed successfully",
        "job_id": job.id,
        "requirements_confirmed": True,
    }

@app.post("/api/v1/jobs/{job_id}/applications", status_code=status.HTTP_202_ACCEPTED)
def upload_resume(
    background_tasks: BackgroundTasks,
    job_id: int,
    candidate_name: str = Form(...),
    candidate_email: str = Form(...),
    resume: UploadFile = File(...),
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    # Only HR users can upload resumes
    if token_data["role"] != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can upload resumes",
        )

    # Validate candidate details
    candidate_name = candidate_name.strip()
    candidate_email = candidate_email.strip()

    if not candidate_name or not candidate_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate name and email are required",
        )

    # Check that the job exists
    job = (
        db.query(JobOpening)
        .filter(JobOpening.id == job_id)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if not job.requirements_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirm job requirements before uploading resumes",
        )

    # Validate extension and declared file type
    original_filename = resume.filename or ""
    file_extension = Path(original_filename).suffix.lower()

    allowed_types = {
        ".pdf": "application/pdf",
        ".docx": (
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
    }

    if file_extension not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX resumes are allowed",
        )

    if resume.content_type != allowed_types[file_extension]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type does not match the file extension",
        )

    # Read at most 5 MB plus one byte to detect oversized files
    max_file_size = 5 * 1024 * 1024

    try:
        file_content = resume.file.read(max_file_size + 1)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read the uploaded resume",
        ) from exc

    if not file_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded resume is empty",
        )

    if len(file_content) > max_file_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Resume must be 5 MB or smaller",
        )

    # Basic file-signature validation
    if file_extension == ".pdf":
        if not file_content.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file is not a valid PDF",
            )
    elif file_extension == ".docx":
        if not file_content.startswith(b"PK"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file is not a valid DOCX",
            )

    # Calculate SHA-256 from the uploaded bytes
    uploaded_hash = sha256(file_content).hexdigest()

    # Detect identical resume content for the same job
    existing_applications = (
        db.query(Application)
        .filter(Application.job_id == job.id)
        .all()
    )

    for existing_application in existing_applications:
        existing_extension = Path(
            existing_application.resume_filename
        ).suffix.lower()

        existing_file = (
            UPLOAD_DIR
            / f"application_{existing_application.id}{existing_extension}"
        )

        # Some historical records may not have a stored file
        if not existing_file.is_file():
            continue

        try:
            existing_hash = sha256(
                existing_file.read_bytes()
            ).hexdigest()
        except OSError:
            logger.warning(
                "Could not read resume for application_id=%s "
                "during duplicate detection",
                existing_application.id,
            )
            continue

        if uploaded_hash == existing_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": (
                        "An identical resume already exists for this job"
                    ),
                    "application_id": existing_application.id,
                    "job_id": job.id,
                },
            )

    # Save candidate, application, and resume
    file_path = None

    try:
        candidate = Candidate(
            name=candidate_name,
            email=candidate_email,
        )
        db.add(candidate)
        db.flush()

        application = Application(
            job_id=job.id,
            candidate_id=candidate.id,
            resume_filename=original_filename,
            screening_status="Queued",
            stage="New",
        )
        db.add(application)
        db.flush()

        stored_filename = (
            f"application_{application.id}{file_extension}"
        )
        file_path = UPLOAD_DIR / stored_filename
        file_path.write_bytes(file_content)

        db.add(
            ApplicationEvent(
                application_id=application.id,
                event_type="application_created",
                description=f"Application created for {job.title}",
            )
        )

        db.commit()
        db.refresh(application)

    except Exception as exc:
        db.rollback()

        if file_path is not None:
            file_path.unlink(missing_ok=True)

        logger.exception("Could not save uploaded resume")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save the uploaded resume.",
        ) from exc

    application_id = application.id
    candidate_id = candidate.id

    background_tasks.add_task(
        process_resume_background,
        application_id,
    )

    return {
        "message": "Resume uploaded successfully; processing queued",
        "application_id": application_id,
        "candidate_id": candidate_id,
        "job_id": job.id,
        "filename": original_filename,
        "screening_status": "Queued",
    }


@app.post("/api/v1/applications/{application_id}/screen")
def screen_candidate(
    application_id: int,
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    # Only HR users can screen candidates
    if token_data["role"] != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can screen candidates",
        )
    application = (
        db.query(Application)
        .filter(Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    try:
        application.screening_status = "Processing"
        db.commit()
        result = screen_application(application_id, db)
        application = (
            db.query(Application)
            .filter(Application.id == application_id)
            .first()
        )
        if application:
            application.screening_status = "Done"
            db.commit()
        result["screening_status"] = "Done"
        return result
    except ValueError as exc:
        db.rollback()
        application = db.query(Application).filter(
            Application.id == application_id
        ).first()
        if application:
            application.screening_status = "Failed"
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        db.rollback()
        application = db.query(Application).filter(
            Application.id == application_id
        ).first()
        if application:
            application.screening_status = "Failed"
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        db.rollback()
        application = db.query(Application).filter(
            Application.id == application_id
        ).first()
        if application:
            application.screening_status = "Failed"
            db.commit()
        logger.exception(
            "Unexpected screening failure for application_id=%s",
            application_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Screening failed due to an unexpected server error.",
        ) from exc
@app.get("/api/v1/applications/{application_id}/screening-results")
def get_screening_results(
    application_id: int,
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    application = (
        db.query(Application)
        .filter(Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    job = (
        db.query(JobOpening)
        .filter(JobOpening.id == application.job_id)
        .first()
    )

    requirements_confirmed = bool(
        job and job.requirements_confirmed
    )

    saved_results = (
        db.query(ScreeningResult)
        .filter(
            ScreeningResult.application_id == application_id
        )
        .order_by(ScreeningResult.id.asc())
        .all()
    )
    # Identify Must-have requirements that are not fully met
    unmet_must_have_requirements = []
    for result in saved_results:
        is_must_have = (
            result.requirement.requirement_type.strip().lower()
            == "must-have"
        )
        if is_must_have and result.assessment != "met":
            unmet_must_have_requirements.append({
                "requirement_id": result.requirement_id,
                "requirement": result.requirement.text,
                "assessment": result.assessment,
            })
    must_have_requirements_met = (
        len(unmet_must_have_requirements) == 0
    )
    # Load missing Must-have requirements saved during screening
    missing_must_haves = safe_json_loads(application.missing_must_haves)
    return {
        "application_id": application.id,
        "job_id": application.job_id,
        # Screening summary
        "score": application.score,
        "screening_status": application.screening_status,
        "verdict": application.verdict,
        "requirements_confirmed": requirements_confirmed,
        "results_current": (
            requirements_confirmed
            and application.screening_status == "Done"
            and bool(saved_results)
        ),
        "results_message": (
            "Screening results are current."
            if (
                requirements_confirmed
                and application.screening_status == "Done"
                and bool(saved_results)
            )
            else (
                "Screening results are unavailable or outdated. "
                "Confirm the current job requirements and screen again."
            )
        ),
        # HR decision details
        "stage": application.stage,
        "stage_reason": application.stage_reason,
        # Must-have requirement details
        "must_have_requirements_met": must_have_requirements_met,
        "unmet_must_have_requirements": (
            unmet_must_have_requirements
        ),
        "missing_must_haves": missing_must_haves,
        # Individual requirement assessments
        "requirements": [
            {
                "requirement_id": result.requirement_id,
                "requirement_text": result.requirement.text,
                "requirement_type": (
                    result.requirement.requirement_type
                ),
                "weight": result.requirement.weight,
                "matched": result.matched,
                "match_ratio": result.match_ratio,
                "assessment": result.assessment,
                "explanation": result.explanation,
                "evidence": safe_json_loads(result.evidence),
                "missing_information": safe_json_loads(result.missing_information),
                "confidence": result.confidence,
            }
            for result in saved_results
        ],
    }
@app.patch("/api/v1/applications/{application_id}/stage")
def update_application_stage(
    application_id: int,
    payload: ApplicationStageUpdate,
    current_user: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    if current_user.get("role") != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can update application stages",
        )
    application = (
        db.query(Application)
        .filter(Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    old_stage = application.stage
    reason = payload.reason.strip() if payload.reason else None
    if reason and len(reason) > 2000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision reason must be 2000 characters or fewer",
        )
    # If the stage is unchanged, update the reason only if necessary.
    if old_stage == payload.stage:
        if reason != application.stage_reason:
            try:
                application.stage_reason = reason
                db.add(
                    ApplicationEvent(
                        application_id=application.id,
                        event_type="Decision Reason Updated",
                        description=(
                            f"Reason updated for stage {application.stage}: "
                            f"{reason or 'No reason provided'}"
                        ),
                    )
                )
                db.commit()
                db.refresh(application)
            except Exception as exc:
                db.rollback()
                logger.exception(
                    "Failed to update decision reason for application_id=%s",
                    application_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update decision reason",
                ) from exc
        return {
            "message": "Application stage is unchanged",
            "application_id": application.id,
            "stage": application.stage,
            "stage_reason": application.stage_reason,
        }
    # Stage changed: save the new stage, reason, and history event together.
    try:
        application.stage = payload.stage
        application.stage_reason = reason
        event_description = (
            f"Stage changed from {old_stage} to {payload.stage}"
        )
        if reason:
            event_description += f". Reason: {reason}"
        db.add(
            ApplicationEvent(
                application_id=application.id,
                event_type="Stage Changed",
                description=event_description,
            )
        )
        db.commit()
        db.refresh(application)
    except Exception as exc:
        db.rollback()
        logger.exception(
            "Failed to update application stage for application_id=%s",
            application_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update application stage and history",
        ) from exc
    return {
        "message": "Application stage updated successfully",
        "application_id": application.id,
        "previous_stage": old_stage,
        "stage": application.stage,
        "stage_reason": application.stage_reason,
    }
@app.get("/api/v1/applications/{application_id}/history")
def get_application_history(
    application_id: int,
    current_user: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    # Find the application
    application = (
        db.query(Application)
        .filter(Application.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    # Fetch history, newest event first
    events = (
        db.query(ApplicationEvent)
        .filter(
            ApplicationEvent.application_id == application_id
        )
        .order_by(ApplicationEvent.created_at.desc())
        .all()
    )
    return {
        "application_id": application_id,
        "history": [
            {
                "id": event.id,
                "event_type": event.event_type,
                "description": event.description,
                "created_at": event.created_at.isoformat(),
            }
            for event in events
        ],
    }
@app.get("/api/v1/applications")
def get_applications(
    token_data: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    applications = (
        db.query(Application, Candidate, JobOpening)
        .join(
            Candidate,
            Application.candidate_id == Candidate.id,
        )
        .join(
            JobOpening,
            Application.job_id == JobOpening.id,
        )
        .filter(JobOpening.deleted_at.is_(None))
        .order_by(Application.id.desc())
        .all()
    )
    return [
        {
            "id": application.id,
            "application_id": application.id,
            "candidate_id": candidate.id,
            "candidate_name": candidate.name,
            "candidate_email": candidate.email,
            "job_id": job.id,
            "job_title": job.title,
            "resume_filename": application.resume_filename,
            "score": application.score,
            "verdict": application.verdict,
            "screening_status": application.screening_status,
            "stage": application.stage,
            "stage_reason": application.stage_reason,
        }
        for application, candidate, job in applications
    ]
@app.put("/api/v1/jobs/{job_id}", response_model=JobResponse)
def update_job(
    job_id: int,
    payload: JobUpdate,
    current_user: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    if current_user.get("role") != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can update jobs",
        )
    job = (
        db.query(JobOpening)
        .filter(JobOpening.id == job_id)
        .first()
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    if not payload.title.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Job title cannot be empty",
        )
    if not payload.description.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Job description cannot be empty",
        )
    job.title = payload.title.strip()
    job.description = payload.description.strip()
    db.commit()
    db.refresh(job)
    return job
@app.delete("/api/v1/jobs/{job_id}")
def soft_delete_job(
    job_id: int,
    current_user: dict = Depends(get_current_user_from_cookie),
    db: Session = Depends(get_db),
):
    if current_user.get("role") != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can delete jobs",
        )
    job = (
        db.query(JobOpening)
        .filter(
            JobOpening.id == job_id,
            JobOpening.deleted_at.is_(None),
        )
        .first()
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active job not found",
        )
    job.deleted_at = datetime.utcnow()
    db.commit()
    return {
        "message": "Job archived successfully",
        "job_id": job.id,
    }
