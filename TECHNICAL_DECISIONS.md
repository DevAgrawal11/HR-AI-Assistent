
# Technical Decisions Log

This document records the main implementation choices and their rationale for the HR AI Assistant.

## 1. Backend Framework — FastAPI

**Decision:** Use FastAPI for the backend API.

**Rationale:**
- Provides request validation and typed API schemas.
- Supports dependency injection for database sessions and authentication.
- Provides interactive API documentation.

## 2. Frontend — React, TypeScript, and Vite

**Decision:** Use React with TypeScript and Vite.

**Rationale:**
- Component-based UI development.
- Type checking during development and builds.
- Fast local development and frontend build tooling.

## 3. Relational Database — PostgreSQL

**Decision:** Use SQLAlchemy with PostgreSQL for application data.

**Rationale:**
- Stores users, jobs, requirements, candidates, applications, screening results, and application events.
- Provides relational integrity between the main entities.
- Supports persistent application data.

SQLite is used for isolated automated tests and synthetic evaluation where appropriate.

## 4. Cookie-Based Authentication

**Decision:** Use an authentication cookie for protected API access.

**Rationale:**
- Allows the browser to send the authentication credential with eligible requests.
- Keeps the credential out of ordinary application JavaScript when the cookie is configured as HttpOnly.

**Security considerations:**
- Use HTTPS in deployed environments.
- Set appropriate Secure, HttpOnly, and SameSite cookie attributes.
- Review CSRF protections, token expiry, and logout behavior.

## 5. Server-Side Role Authorization

**Decision:** Enforce HR and Viewer permissions in backend endpoints.

**Rationale:**
Frontend visibility alone cannot protect sensitive operations. The backend must verify authorization before accepting protected actions such as resume uploads or application-stage changes.

## 6. Resume Upload Validation

**Decision:** Validate supported extensions, content type, size, non-empty content, and basic file signatures.

**Rationale:**
These checks reject common invalid uploads before further processing.

**Limitation:** Extension, MIME type, and signature checks are not a complete malware or document-security solution.

## 7. Duplicate Resume Detection

**Decision:** Use SHA-256 content hashes to detect duplicate resume files within the implemented duplicate-checking scope.

**Rationale:**
Hashing allows byte-identical files to be identified without relying on their filenames.

**Limitation:** Different files containing the same resume text may have different hashes. Hash matches should be interpreted according to the application's configured duplicate policy.

## 8. AI-Assisted Requirement Assessment

**Decision:** Use Gemini to produce structured assessments for confirmed job requirements.

**Rationale:**
Structured output can be validated against the expected requirement IDs and the application's assessment schema.

The AI response is treated as an assessment input, not as an authoritative hiring decision.

## 9. Evidence Verification

**Decision:** Verify each supplied evidence quotation against the original resume text before using the assessment in scoring.

**Rationale:**
This reduces the risk of awarding points for fabricated or unverifiable quotations.

**Limitation:** A quotation matching the resume does not independently prove that the requirement is satisfied. Semantic correctness still requires careful assessment and human review.

## 10. Weighted Scoring and Must-Have Requirements

**Decision:** Calculate a weighted evidence score and separately track must-have requirements.

Current scoring rules include:
- `met` receives full scoring credit.
- `partially_met` receives partial credit for optional requirements.
- Unmet must-have requirements trigger `Needs Review`.
- An assessment downgraded to `unknown` receives zero scoring credit.
- A score of at least 70% results in `Strong Match` only when all must-have requirements are met.
- A non-positive total weight results in `Review`.

**Rationale:** Separating must-have requirements from weighted optional requirements prevents a high optional-skill score from overriding a missing mandatory qualification.

The score is a heuristic, not a probability of candidate success.

## 11. Screening Status Consistency

**Decision:** Standardize the successful screening status as `Done`.

**Rationale:** The screening service, API workflows, and screening-results endpoint must use the same status value to avoid inconsistent result freshness checks.

The other statuses currently used by the workflow are `Queued`, `Processing`, and `Failed`.

## 12. Failure Handling

**Decision:** Handle screening failures explicitly and record the failed status.

**Rationale:**
This allows HR to distinguish completed screening from work that failed during processing and may need retry or investigation.

Failure details should be limited to safe diagnostic information and should not expose credentials or unnecessary personal data.

## 13. Automated Testing

**Decision:** Use pytest and isolated SQLite databases for backend tests.

**Rationale:**
- Tests can run without modifying real candidate records.
- Authentication, upload validation, duplicate detection, stage history, and failure paths can be tested repeatably.
- Dependency overrides and mocked functions allow error conditions to be simulated.

## 14. Synthetic Evaluation

**Decision:** Maintain a separate evaluation script with 12 synthetic cases and mocked AI assessments.

**Rationale:**
This provides a deterministic way to test evidence validation, scoring, and verdict rules without requiring a live Gemini call for every run.

**Recorded result:** 12 out of 12 cases matched their predefined expected verdicts.

**Interpretation:** This is deterministic screening-logic agreement, not a measure of Gemini accuracy, fairness, or real-world recruitment performance. A separate labeled dataset with independently established ground truth is needed for those evaluations.

## 15. Human Oversight

**Decision:** Keep hiring decisions with HR.

**Rationale:**
The system provides preliminary evidence and screening guidance. HR must review relevant evidence, missing information, and candidate context before making employment decisions.
