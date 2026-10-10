import json
import os
import re

from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import APIError

from ai_schemas import ResumeProfile, ScreeningAssessment

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not configured")

client = genai.Client(api_key=GEMINI_API_KEY)

MODEL_NAME = "gemini-3.8-flash"


def generate_response(prompt: str) -> str:
    """Generate a normal text response using Gemini."""
    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
        )
    except APIError as exc:
        raise RuntimeError(
            "Gemini service is temporarily unavailable. "
            "Please try again later."
        ) from exc

    if not response.text:
        raise RuntimeError("Gemini returned an empty response")

    return response.text


def _redact_profile_value(value):
    """Remove identifying fields from a profile before scoring."""
    sensitive_keys = {
        "name",
        "fullname",
        "candidatename",
        "email",
        "phone",
        "phonenumber",
        "mobile",
        "mobilenumber",
        "address",
        "streetaddress",
        "homeaddress",
        "postaladdress",
    }

    if isinstance(value, dict):
        cleaned = {}

        for key, item in value.items():
            normalized_key = re.sub(
                r"[^a-z]",
                "",
                str(key).lower(),
            )

            if normalized_key in sensitive_keys:
                cleaned[key] = None
            else:
                cleaned[key] = _redact_profile_value(item)

        return cleaned

    if isinstance(value, list):
        return [_redact_profile_value(item) for item in value]

    if isinstance(value, str):
        # Remove email addresses and common phone-number formats
        # that may appear in free-text profile fields.
        value = re.sub(
            r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
            "[REDACTED_EMAIL]",
            value,
            flags=re.IGNORECASE,
        )
        value = re.sub(
            r"(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)",
            "[REDACTED_PHONE]",
            value,
        )

    return value


def build_screening_prompt(
    profile: ResumeProfile,
    requirements: list[dict],
) -> str:
    """Build a screening prompt without structured PII fields."""
    redacted_profile = _redact_profile_value(
        profile.model_dump(mode="json")
    )

    return f"""
You are assisting HR with preliminary resume screening.

Assess the supplied resume profile against each job requirement.

Rules:
- Evaluate every requirement separately.
- Use only evidence present in the supplied profile.
- Do not invent skills, experience, dates, or qualifications.
- Do not infer that a candidate lacks a skill merely because it
  is absent from the resume.
- Use "met" when the available evidence supports the requirement.
- Use "partially_met" when evidence supports only part of it.
- Use "not_evidenced" when the resume does not demonstrate it.
- Use "insufficient_information" when the available information
  is too ambiguous to assess.
- Evidence must be a short, exact quotation from the original resume.
- Do not create quotations from summaries or paraphrased profile fields.
- Explain missing or unverified information separately.
- Do not make a hiring decision or change a candidate's stage.
- Return one assessment for every requirement, preserving its ID.
- Confidence must be a number between 0 and 1.
- Confidence is an estimate, not a calibrated probability.

RESUME PROFILE WITH IDENTIFIERS REMOVED:
{json.dumps(redacted_profile, ensure_ascii=False, indent=2)}

JOB REQUIREMENTS:
{json.dumps(requirements, ensure_ascii=False, indent=2)}
"""


def assess_resume_against_requirements(
    profile: ResumeProfile,
    requirements: list[dict],
) -> ScreeningAssessment:
    """Assess a redacted profile against job requirements using Gemini."""
    if not requirements:
        raise ValueError("At least one requirement is required")

    prompt = build_screening_prompt(profile, requirements)

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScreeningAssessment,
                temperature=0,
            ),
        )
    except APIError as exc:
        raise RuntimeError(
            "Gemini screening service is temporarily unavailable. "
            "Please try again later."
        ) from exc

    if not response.text:
        raise RuntimeError(
            "Gemini returned an empty screening response"
        )

    assessment = ScreeningAssessment.model_validate_json(
        response.text
    )

    expected_ids = {
        item["requirement_id"] for item in requirements
    }
    returned_ids = [
        item.requirement_id
        for item in assessment.assessments
    ]

    if (
        set(returned_ids) != expected_ids
        or len(returned_ids) != len(expected_ids)
    ):
        raise ValueError(
            "Gemini returned missing, duplicate, or unexpected "
            "requirement IDs"
        )

    return assessment


def extract_resume_profile(resume_text: str) -> ResumeProfile:
    """Extract structured candidate information from resume text."""
    if not resume_text.strip():
        raise ValueError("Resume text is empty")

    prompt = f"""
Extract candidate information from the resume provided below.

Rules:
- Use only information supported by the resume.
- Do not invent skills, qualifications, experience, or projects.
- Use null for missing name, email, or phone.
- Use empty lists when education, experience, projects, or
  certifications are not provided.
- Preserve the meaning of the candidate's actual experience.
- Return the extracted information using the requested schema.

RESUME TEXT:
{resume_text}
"""

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ResumeProfile,
            ),
        )
    except APIError as exc:
        raise RuntimeError(
            "Gemini resume extraction service is temporarily "
            "unavailable. Please try again later."
        ) from exc

    if not response.text:
        raise RuntimeError(
            "Gemini returned an empty extraction response"
        )

    return ResumeProfile.model_validate_json(response.text)
