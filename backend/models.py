from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)

    job_openings: Mapped[list["JobOpening"]] = relationship(
        back_populates="created_by"
    )


class JobOpening(Base):
    __tablename__ = "job_openings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Draft")

    requirements_confirmed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
    DateTime, nullable=True, default=None
    )

    created_by: Mapped["User"] = relationship(
        back_populates="job_openings"
    )

    applications: Mapped[list["Application"]] = relationship(
        back_populates="job"
    )

    requirements: Mapped[list["Requirement"]] = relationship(
        back_populates="job",
        cascade="all, delete-orphan",
    )


class Requirement(Base):
    __tablename__ = "requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    job_id: Mapped[int] = mapped_column(
        ForeignKey("job_openings.id"), nullable=False
    )

    text: Mapped[str] = mapped_column(Text, nullable=False)
    requirement_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )

    weight: Mapped[float] = mapped_column(
        Float, default=1.0, nullable=False
    )

    sort_order: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )

    job: Mapped["JobOpening"] = relationship(
        back_populates="requirements"
    )


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    job_id: Mapped[int] = mapped_column(
        ForeignKey("job_openings.id"), nullable=False
    )

    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.id"), nullable=False
    )

    resume_filename: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    resume_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    resume_profile: Mapped[str | None] = mapped_column(Text, nullable=True)

    screening_status: Mapped[str] = mapped_column(
        String(20), default="Queued"
    )

    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    verdict: Mapped[str | None] = mapped_column(String(50), nullable=True)

    missing_must_haves: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    stage: Mapped[str] = mapped_column(String(30), default="New")
    stage_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    job: Mapped["JobOpening"] = relationship(
        back_populates="applications"
    )


class ApplicationEvent(Base):
    __tablename__ = "application_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id"), nullable=False
    )

    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


class ScreeningResult(Base):
    __tablename__ = "screening_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id"), nullable=False
    )

    requirement_id: Mapped[int] = mapped_column(
        ForeignKey("requirements.id"), nullable=False
    )

    # Existing keyword-matching fields
    matched: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    match_ratio: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )

    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)

    # New AI screening fields
    assessment: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )

    explanation: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    missing_information: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    confidence: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )

    requirement: Mapped["Requirement"] = relationship()
