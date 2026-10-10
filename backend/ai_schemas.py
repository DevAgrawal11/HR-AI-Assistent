from typing import Literal

from pydantic import BaseModel, Field


class EducationItem(BaseModel):
    degree: str
    institution: str
    field_of_study: str | None = None
    graduation_year: int | None = None


class ExperienceItem(BaseModel):
    company: str
    job_title: str
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None


class ResumeProfile(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None

    skills: list[str] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    experience: list[ExperienceItem] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)


class RequirementAssessment(BaseModel):
    requirement_id: int

    assessment: Literal[
        "met",
        "partially_met",
        "not_evidenced",
        "insufficient_information",
        "unknown",
    ]

    explanation: str = Field(
        description="Brief explanation based on resume evidence"
    )

    evidence: list[str] = Field(
        default_factory=list,
        description=(
            "Exact quotations from the original resume that support "
            "the assessment. Do not paraphrase."
        ),
    )

    missing_information: list[str] = Field(
        default_factory=list,
        description=(
            "Relevant information not demonstrated in the resume"
        ),
    )

    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in this assessment, from 0 to 1",
    )


class ScreeningAssessment(BaseModel):
    assessments: list[RequirementAssessment] = Field(
        default_factory=list
    )
