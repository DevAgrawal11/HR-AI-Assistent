
import csv
import json
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import (
    Application,
    Candidate,
    JobOpening,
    Requirement,
    ScreeningResult,
    User,
)
from ai_schemas import RequirementAssessment, ScreeningAssessment
import screening_service


# All data is synthetic. No real candidate records are used.
CASES = [
    {
        "id": "candidate_01",
        "description": "Meets all requirements",
        "assessments": ["met", "met", "met"],
        "expected_verdict": "Strong Match",
    },
    {
        "id": "candidate_02",
        "description": "Meets must-have; partially meets optional skill",
        "assessments": ["met", "partially_met", "met"],
        "expected_verdict": "Strong Match",
    },
    {
        "id": "candidate_03",
        "description": "Must-have only partially met",
        "assessments": ["partially_met", "met", "met"],
        "expected_verdict": "Needs Review",
    },
    {
        "id": "candidate_04",
        "description": "Must-have not evidenced",
        "assessments": ["not_evidenced", "met", "met"],
        "expected_verdict": "Needs Review",
    },
    {
        "id": "candidate_05",
        "description": "Must-have met; optional skills absent",
        "assessments": ["met", "not_evidenced", "not_evidenced"],
        "expected_verdict": "Review",
    },
    {
        "id": "candidate_06",
        "description": "Must-have met; one optional skill partial",
        "assessments": ["met", "partially_met", "not_evidenced"],
        "expected_verdict": "Review",
    },
    {
        "id": "candidate_07",
        "description": "Insufficient information for must-have",
        "assessments": [
            "insufficient_information",
            "met",
            "met",
        ],
        "expected_verdict": "Needs Review",
    },
    {
        "id": "candidate_08",
        "description": "Must-have met; optional information ambiguous",
        "assessments": [
            "met",
            "insufficient_information",
            "met",
        ],
        "expected_verdict": "Strong Match",
    },
    {
        "id": "candidate_09",
        "description": "Must-have met; another skill unknown",
        "assessments": ["met", "unknown", "met"],
        "expected_verdict": "Strong Match",
    },
    {
        "id": "candidate_10",
        "description": "Must-have met; optional skills partially met",
        "assessments": [
            "met",
            "partially_met",
            "partially_met",
        ],
        "expected_verdict": "Strong Match",
    },
    {
        "id": "candidate_11",
        "description": "Unverifiable evidence for must-have",
        "assessments": ["met", "met", "met"],
        "invalid_evidence_for": 1,
        "expected_verdict": "Needs Review",
    },
    {
        "id": "candidate_12",
        "description": "No requirements have positive weight",
        "assessments": ["met", "met", "met"],
        "zero_weights": True,
        "expected_verdict": "Review",
    },
]


def build_assessment_response(profile, requirements):
    """Return deterministic mock AI results for each synthetic case."""
    case = next(
        item for item in CASES if item["id"] == profile.name
    )

    assessments = []

    for index, requirement in enumerate(requirements):
        assessment_label = case["assessments"][index]
        evidence = []

        # This deliberately invalid quote tests evidence verification.
        if case.get("invalid_evidence_for") == index + 1:
            evidence = ["I am an expert Java architect."]

        assessments.append(
            RequirementAssessment(
                requirement_id=requirement["requirement_id"],
                assessment=assessment_label,
                explanation=f"Mock assessment: {assessment_label}",
                evidence=evidence,
                missing_information=[],
                confidence=0.95,
            )
        )

    return ScreeningAssessment(assessments=assessments)


def main():
    # In-memory SQLite: isolated from the configured PostgreSQL database.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    TestingSession = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )

    original_assessor = (
        screening_service.assess_resume_against_requirements
    )

    try:
        Base.metadata.create_all(bind=engine)
        db = TestingSession()

        try:
            hr_user = User(
                email="synthetic-evaluation@example.com",
                password_hash="not-used",
                role="HR",
            )
            db.add(hr_user)
            db.flush()

            job = JobOpening(
                title="Synthetic Evaluation Job",
                description="Synthetic job used only for evaluation",
                status="Open",
                requirements_confirmed=True,
                created_by_id=hr_user.id,
            )
            db.add(job)
            db.flush()

            requirement_specs = [
                ("Java", "Must-have", 5.0),
                ("SQL", "Nice-to-have", 3.0),
                ("REST APIs", "Nice-to-have", 2.0),
            ]

            requirements = []

            for order, (text, kind, weight) in enumerate(
                requirement_specs, start=1
            ):
                requirement = Requirement(
                    job_id=job.id,
                    text=text,
                    requirement_type=kind,
                    weight=weight,
                    sort_order=order,
                )
                db.add(requirement)
                requirements.append(requirement)

            db.flush()

            # Keep the actual production screening function, but replace
            # only its external AI assessment dependency.
            screening_service.assess_resume_against_requirements = (
                build_assessment_response
            )

            report_rows = []

            for case in CASES:
                if case.get("zero_weights"):
                    for requirement in requirements:
                        requirement.weight = 0.0
                    db.flush()
                else:
                    for requirement, spec in zip(
                        requirements, requirement_specs
                    ):
                        requirement.weight = spec[2]
                    db.flush()

                candidate = Candidate(
                    name=case["id"],
                    email=f'{case["id"]}@example.test',
                )
                db.add(candidate)
                db.flush()

                application = Application(
                    job_id=job.id,
                    candidate_id=candidate.id,
                    resume_filename=f'{case["id"]}.pdf',
                    resume_text=(
                        "Synthetic resume for evaluation. "
                        "Skills and experience are simulated."
                    ),
                    resume_profile=json.dumps({"name": case["id"]}),
                    screening_status="Queued",
                    stage="New",
                )
                db.add(application)
                db.commit()
                db.refresh(application)

                result = screening_service.screen_application(
                    application.id, db
                )

                expected = case["expected_verdict"]
                actual = result["verdict"]

                report_rows.append(
                    {
                        "candidate_id": case["id"],
                        "scenario": case["description"],
                        "expected_verdict": expected,
                        "actual_verdict": actual,
                        "score": result["score"],
                        "screening_status": result["screening_status"],
                        "verdict_match": expected == actual,
                        "must_have_requirements_met": result[
                            "must_have_requirements_met"
                        ],
                    }
                )

            output_path = (
                Path(__file__).resolve().parent
                / "evaluation_report.csv"
            )

            with output_path.open(
                "w", newline="", encoding="utf-8"
            ) as report_file:
                writer = csv.DictWriter(
                    report_file,
                    fieldnames=list(report_rows[0].keys()),
                )
                writer.writeheader()
                writer.writerows(report_rows)

            matches = sum(
                row["verdict_match"] for row in report_rows
            )

            print("\nSCREENING EVALUATION")
            print("=" * 60)
            print(f"Cases evaluated: {len(report_rows)}")
            print(f"Expected verdicts matched: {matches}/{len(report_rows)}")
            print(
                "Deterministic verdict agreement: "
                f"{matches / len(report_rows) * 100:.1f}%"
            )
            print("\nIndividual results:")

            for row in report_rows:
                outcome = "PASS" if row["verdict_match"] else "FAIL"
                print(
                    f'{outcome} | {row["candidate_id"]} | '
                    f'Score: {row["score"]:.2f} | '
                    f'Expected: {row["expected_verdict"]} | '
                    f'Actual: {row["actual_verdict"]}'
                )

            print(f"\nReport saved to: {output_path}")

        finally:
            db.close()

    finally:
        screening_service.assess_resume_against_requirements = (
            original_assessor
        )
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


if __name__ == "__main__":
    main()
