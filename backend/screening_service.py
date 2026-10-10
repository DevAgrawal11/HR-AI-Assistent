import json
import re

from ai_schemas import ResumeProfile
from gemini_service import assess_resume_against_requirements
from models import (
    Application,
    JobOpening,
    Requirement,
    ScreeningResult,
)
from sqlalchemy.orm import Session


def normalize_text(text: str) -> str:
    """Normalize whitespace and case for evidence matching."""
    return " ".join(text.casefold().split())


def validate_evidence_quotes(
    assessment,
    resume_text: str,
) -> bool:
    """
    Verify every evidence quote against the original resume text.

    Returns True when all supplied quotes are valid.
    Invalid evidence downgrades the assessment to unknown.
    """
    original_text = normalize_text(resume_text)
    evidence = assessment.evidence or []

    if not evidence:
        return True

    for quote in evidence:
        if not isinstance(quote, str) or not quote.strip():
            assessment.assessment = "unknown"
            assessment.evidence = []
            assessment.explanation = (
                "The AI did not provide verifiable evidence "
                "from the original resume."
            )
            assessment.confidence = 0.0
            return False

        normalized_quote = normalize_text(quote)

        if not normalized_quote or normalized_quote not in original_text:
            assessment.assessment = "unknown"
            assessment.evidence = []
            assessment.explanation = (
                "The AI-provided evidence could not be verified "
                "against the original resume. HR review is required."
            )
            assessment.confidence = 0.0
            return False

    return True


def screen_application(application_id: int, db: Session) -> dict:
    """Screen an application against confirmed job requirements."""

    application = (
        db.query(Application)
        .filter(Application.id == application_id)
        .first()
    )

    if not application:
        raise ValueError("Application not found")

    if not application.resume_profile:
        raise ValueError("Application has no extracted resume profile")

    job = (
        db.query(JobOpening)
        .filter(JobOpening.id == application.job_id)
        .first()
    )

    if not job:
        raise ValueError("Job not found")

    if not job.requirements_confirmed:
        raise ValueError(
            "Job requirements must be confirmed before screening. "
            "Review and confirm the current requirements first."
        )

    requirements = (
        db.query(Requirement)
        .filter(Requirement.job_id == application.job_id)
        .order_by(Requirement.sort_order.asc())
        .all()
    )

    if not requirements:
        raise ValueError("No requirements found for this job")

    try:
        profile_data = json.loads(application.resume_profile)
        profile = ResumeProfile.model_validate(profile_data)
    except (json.JSONDecodeError, ValueError, TypeError) as exc:
        raise ValueError(
            "Application resume profile is invalid. Re-upload the resume."
        ) from exc

    # The original text is used locally for quote verification only.
    # It is not passed directly to the screening model.
    resume_text = getattr(application, "resume_text", None) or ""

    if not resume_text.strip():
        raise ValueError(
            "Original resume text is unavailable; evidence cannot be verified."
        )

    requirement_inputs = [
        {
            "requirement_id": requirement.id,
            "text": requirement.text,
            "requirement_type": requirement.requirement_type,
            "weight": requirement.weight,
        }
        for requirement in requirements
    ]

    assessment_response = assess_resume_against_requirements(
        profile,
        requirement_inputs,
    )

    assessments_by_id = {}

    for item in assessment_response.assessments:
        if item.requirement_id in assessments_by_id:
            raise ValueError(
                "AI screening returned duplicate assessments for "
                f"requirement ID: {item.requirement_id}"
            )
        assessments_by_id[item.requirement_id] = item

    expected_ids = {requirement.id for requirement in requirements}
    returned_ids = set(assessments_by_id)

    missing_ids = expected_ids - returned_ids
    unexpected_ids = returned_ids - expected_ids

    if missing_ids:
        raise ValueError(
            "AI screening did not return assessments for all requirements. "
            f"Missing requirement IDs: {sorted(missing_ids)}"
        )

    if unexpected_ids:
        raise ValueError(
            "AI screening returned unknown requirement IDs: "
            f"{sorted(unexpected_ids)}"
        )

    score_values = {
        "met": 1.0,
        "partially_met": 0.5,
        "not_evidenced": 0.0,
        "insufficient_information": 0.0,
        "unknown": 0.0,
    }

    # Verify evidence before using any assessment in scoring.
    for assessment in assessments_by_id.values():
        if assessment.assessment not in score_values:
            raise ValueError(
                f"Unexpected assessment: {assessment.assessment}"
            )

        validate_evidence_quotes(assessment, resume_text)

    results = []
    weighted_score = 0.0
    total_weight = 0.0
    must_have_requirements_met = True
    unmet_must_have_requirements = []

    try:
        db.query(ScreeningResult).filter(
            ScreeningResult.application_id == application.id
        ).delete(synchronize_session=False)

        for requirement in requirements:
            assessment = assessments_by_id[requirement.id]
            weight = max(float(requirement.weight or 0), 0.0)
            match_ratio = score_values[assessment.assessment]

            is_must_have = (
                requirement.requirement_type.strip().lower()
                == "must-have"
            )

            if is_must_have and assessment.assessment == "partially_met":
                match_ratio = 0.0

            if is_must_have and assessment.assessment != "met":
                must_have_requirements_met = False
                unmet_must_have_requirements.append(
                    {
                        "requirement_id": requirement.id,
                        "requirement": requirement.text,
                        "assessment": assessment.assessment,
                    }
                )

            evidence_json = json.dumps(assessment.evidence or [])
            missing_json = json.dumps(
                assessment.missing_information or []
            )

            is_matched = assessment.assessment == "met" or (
                assessment.assessment == "partially_met"
                and not is_must_have
            )

            db.add(
                ScreeningResult(
                    application_id=application.id,
                    requirement_id=requirement.id,
                    matched=is_matched,
                    match_ratio=match_ratio,
                    evidence=evidence_json,
                    assessment=assessment.assessment,
                    explanation=assessment.explanation,
                    missing_information=missing_json,
                    confidence=assessment.confidence,
                )
            )

            results.append(
                {
                    "requirement_id": requirement.id,
                    "requirement": requirement.text,
                    "requirement_type": requirement.requirement_type,
                    "weight": weight,
                    "assessment": assessment.assessment,
                    "matched": is_matched,
                    "match_ratio": match_ratio,
                    "explanation": assessment.explanation,
                    "evidence": assessment.evidence or [],
                    "missing_information": (
                        assessment.missing_information or []
                    ),
                    "confidence": assessment.confidence,
                }
            )

            weighted_score += match_ratio * weight
            total_weight += weight

        score = (
            round(weighted_score / total_weight * 100, 2)
            if total_weight > 0
            else 0.0
        )

        if total_weight <= 0:
            verdict = "Review"
        elif not must_have_requirements_met:
            verdict = "Needs Review"
        elif score >= 70:
            verdict = "Strong Match"
        else:
            verdict = "Review"

        application.score = score
        application.verdict = verdict
        application.screening_status = "Done"
        application.missing_must_haves = json.dumps(
            unmet_must_have_requirements
        )

        db.commit()
        db.refresh(application)

    except Exception:
        db.rollback()
        raise

    return {
        "application_id": application.id,
        "job_id": application.job_id,
        "score": score,
        "verdict": application.verdict,
        "screening_status": application.screening_status,
        "must_have_requirements_met": must_have_requirements_met,
        "unmet_must_have_requirements": unmet_must_have_requirements,
        "requirements": results,
        "scoring_note": (
            "Preliminary AI-assisted evidence score. Unverified quotes "
            "are downgraded to unknown and receive zero scoring credit. "
            "These scores are heuristic values, not probabilities."
        ),
        "note": (
            "Unmet or unverified Must-have requirements are flagged for "
            "HR review; they do not automatically reject a candidate. "
            "HR makes all final hiring decisions."
        ),
    }
