from types import SimpleNamespace

from gemini_service import build_screening_prompt
from screening_service import validate_evidence_quotes
from ai_schemas import ResumeProfile, RequirementAssessment


def make_assessment(evidence):
    return SimpleNamespace(
        assessment="met",
        evidence=evidence,
        explanation="Assessment based on resume evidence.",
        confidence=0.9,
    )


def test_valid_evidence_quote_is_preserved():
    resume_text = (
        "Dev worked as a Java Developer for two years "
        "and built REST APIs."
    )
    assessment = make_assessment(
        ["built REST APIs"]
    )

    result = validate_evidence_quotes(assessment, resume_text)

    assert result is True
    assert assessment.assessment == "met"
    assert assessment.evidence == ["built REST APIs"]


def test_invalid_evidence_quote_is_downgraded_to_unknown():
    resume_text = "The candidate has experience with Java."
    assessment = make_assessment(
        ["Expert in machine learning and cloud architecture"]
    )

    result = validate_evidence_quotes(assessment, resume_text)

    assert result is False
    assert assessment.assessment == "unknown"
    assert assessment.evidence == []
    assert assessment.confidence == 0.0


def test_empty_evidence_does_not_claim_a_quote_was_verified():
    resume_text = "The candidate has experience with Java."
    assessment = make_assessment([])

    result = validate_evidence_quotes(assessment, resume_text)

    assert result is True
    assert assessment.evidence == []


def test_screening_prompt_redacts_structured_personal_information():
    profile = ResumeProfile(
        name="Dev Agrawal",
        email="dev.agrawal@example.com",
        phone="+91 9876543210",
        skills=["Java", "REST APIs"],
    )

    prompt = build_screening_prompt(
        profile,
        [
            {
                "requirement_id": 1,
                "text": "Experience with Java",
                "requirement_type": "must-have",
                "weight": 5,
            }
        ],
    )

    assert "Dev Agrawal" not in prompt
    assert "dev.agrawal@example.com" not in prompt
    assert "+91 9876543210" not in prompt
    assert "Java" in prompt
    assert "REST APIs" in prompt
