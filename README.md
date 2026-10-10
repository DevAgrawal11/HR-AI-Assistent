
# HR AI Assistant

An AI-assisted recruitment screening application built with FastAPI, React, TypeScript, and PostgreSQL. The system helps HR users compare candidate resume profiles against confirmed job requirements, verify supporting evidence, and review screening results.

## Features

- **Role-based access:** HR and Viewer roles with authenticated API access.
- **Job management:** Job openings and job requirements.
- **Resume upload:** PDF and DOCX validation, file-size checks, and duplicate detection.
- **Resume processing:** Text extraction and structured resume profiles.
- **AI-assisted screening:** Requirement-level assessments using Gemini.
- **Evidence verification:** AI-provided evidence quotations are checked against the original resume text before scoring.
- **Weighted scoring:** Requirement weights contribute to a preliminary match score.
- **Must-have checks:** Unmet must-have requirements trigger a Needs Review verdict.
- **Application tracking:** Screening status, application stage, and stage-change history.
- **Screening failure handling:** Failed processing is recorded so HR can investigate.
- **Automated tests:** Tests for authentication, upload validation, duplicate uploads, stage history, and screening failures.
- **Synthetic evaluation:** A repeatable 12-case screening logic evaluation.

## Technology Stack

### Backend
- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- Pydantic
- Gemini API
- PDF/DOCX resume processing

### Frontend
- React
- TypeScript
- Vite

### Testing and infrastructure
- pytest
- SQLite for isolated tests and synthetic evaluation
- Docker Compose for the database environment

## Project Structure

```text
.
├── backend/
│   ├── main.py
│   ├── auth.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── ai_schemas.py
│   ├── gemini_service.py
│   ├── resume_parser.py
│   ├── screening_service.py
│   ├── seed.py
│   ├── evaluate_screening.py
│   ├── evaluation_report.csv
│   └── tests/
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
├── README.md
└── TECHNICAL_DECISIONS.md
```

## Prerequisites

Install the following before running the application:

- Python and a virtual environment
- Node.js and npm
- PostgreSQL, or Docker with Docker Compose
- A Gemini API key for live AI functionality

Use the Python and Node.js versions configured for your development environment.

## Configuration

Create or update the root `.env` file with the required environment variables.

Example:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/hr_ai
JWT_SECRET=replace_with_a_strong_random_secret
GEMINI_API_KEY=your_gemini_api_key
```

Use the exact Gemini variable name expected by `backend/gemini_service.py`. Never commit real credentials or production secrets to source control.

## Running the Backend

From the project root:

```bash
source .venv/bin/activate
```

Install the backend dependencies using your project's dependency manifest, if one is configured.

Then run:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The API health endpoint is:

```text
GET http://localhost:8000/api/health
```

API documentation is available at:

```text
http://localhost:8000/docs
```

## Running the Frontend

Open a separate terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Use the local URL printed by Vite.

For a production build:

```bash
npm run build
```

## Database

A Docker Compose configuration is provided in `docker-compose.yml`.

Inspect the configured services before starting them:

```bash
docker compose config
```

Start the configured services with:

```bash
docker compose up -d
```

The backend's database configuration must match the database host, port, name, and credentials in the Compose configuration.

## Authentication and Authorization

The API uses cookie-based authentication. The backend issues an authentication cookie after a successful login and validates it on protected endpoints.

The application distinguishes HR and Viewer permissions. Sensitive operations, such as changing an application's stage or uploading resumes, should be restricted to authorized HR users on the backend, not merely hidden in the frontend.

## Screening Workflow

1. HR creates a job opening and defines its requirements.
2. HR reviews and confirms the requirements.
3. A resume is uploaded and validated.
4. The resume is processed into text and a structured profile.
5. The AI assesses the profile against each confirmed requirement.
6. The backend validates assessment IDs and evidence quotations.
7. Weighted scores and a preliminary verdict are calculated.
8. HR reviews the results and makes the hiring decision.

### Screening statuses

The current screening workflow uses these statuses:

- `Queued`
- `Processing`
- `Done`
- `Failed`

### Verdicts

- **Strong Match:** Score is at least 70% and all must-have requirements are met.
- **Needs Review:** At least one must-have requirement is not fully met.
- **Review:** The weighted score is below the threshold, or there is no positive total requirement weight.

Scores are heuristic evidence scores, not probabilities of job success. Screening results assist HR; they do not replace human review or make the final hiring decision.

## Automated Tests

Run the backend test suite from the project root:

```bash
PYTHONPATH=backend python -m pytest backend/tests -v
```

The current recorded result is **26 passing tests**. Run the command again after code changes to confirm the current result.

## Synthetic Screening Evaluation

Run:

```bash
PYTHONPATH=backend python backend/evaluate_screening.py
```

The script uses synthetic cases and mocked AI assessments while exercising the actual screening and scoring logic. It writes results to:

```text
backend/evaluation_report.csv
```

The recorded run produced 12/12 expected verdict matches.

**Interpretation:** This measures agreement between the existing deterministic screening logic and predefined expected verdicts. It does not measure Gemini's real-world accuracy, fairness, or hiring outcomes.

## Security and Deployment Considerations

Before production deployment:

- Configure strong secrets and keep `.env` out of source control.
- Use HTTPS and secure cookie settings.
- Configure appropriate CORS and trusted frontend origins.
- Review authentication, authorization, and session-expiration behavior.
- Restrict resume-file access and validate uploads.
- Protect personal information and define data-retention policies.
- Keep API keys and database credentials out of logs and client-side code.
- Test the deployment and database configuration in a clean environment.

## Current Limitations

- AI assessments depend on the external Gemini service when live screening is used.
- Synthetic evaluation uses mocked assessments and does not establish real-world model accuracy.
- Screening scores are heuristic and should not be interpreted as calibrated probabilities.
- Production deployment and HTTPS configuration must be verified separately.

## License

Add the appropriate license and ownership information before distributing the project.
