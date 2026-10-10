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

### Testing and Infrastructure
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
│   ├── requirements.txt
│   └── tests/
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
├── README.md
├── TECHNICAL_DECISIONS.md
└── .gitignore
```

## Prerequisites

Install the following before running the application:

- Python 3.13 or a compatible Python version
- Node.js and npm
- Docker and Docker Compose
- A Gemini API key for live AI functionality

The application uses PostgreSQL for persistent database storage. Docker Compose starts the PostgreSQL service; the backend and frontend run separately using their respective commands below.

## Configuration

Create a root `.env` file in the project directory. Do not commit this file to Git.

Configure the following variables:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/hr_ai
JWT_SECRET=replace_with_a_strong_random_secret
GEMINI_API_KEY=your_gemini_api_key
POSTGRES_PASSWORD=your_database_password
```

Use matching database credentials in `DATABASE_URL` and `POSTGRES_PASSWORD`. The database name and username must also match the Docker Compose configuration, unless you explicitly override its defaults.

Generate a strong, random JWT secret for your environment. Never commit actual credentials, API keys, or production secrets to source control.

The backend reads its environment configuration from the root `.env` file. Check `backend/database.py`, `backend/auth.py`, and `backend/gemini_service.py` if you need to confirm the variables used by the application.

## Database Setup

From the project root, validate the Docker Compose configuration:

```bash
docker compose config --quiet
```

If validation succeeds, start PostgreSQL:

```bash
docker compose up -d postgres
```

Check the database container:

```bash
docker compose ps
```

The configured PostgreSQL database is exposed on port `5432`.

Ensure the database credentials in `.env` match the database configuration. If you are using an existing PostgreSQL data volume, changing `POSTGRES_PASSWORD` in the environment does not automatically change the password of an already initialized database.

**Warning:** Do not remove the PostgreSQL volume to resolve credential issues unless you deliberately intend to delete the stored database data.

## Running the Backend

From the project root, create and activate a Python virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

Install the backend dependencies:

```bash
python -m pip install -r backend/requirements.txt
```

Start the backend from the project root:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The API health endpoint is:

```text
http://localhost:8000/api/health
```

API documentation is available at:

```text
http://localhost:8000/docs
```

Keep the backend terminal running while using the application.

## Running the Frontend

Open a separate terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173/
```

Keep the frontend terminal running while using the application.

### Production Build

To compile the frontend for production:

```bash
cd frontend
npm run build
```

The generated production files are placed in `frontend/dist/`. This build step does not itself deploy the frontend.

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

### Screening Statuses

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

Run the backend test suite from the project root with the backend directory included in Python's module search path:

```bash
source .venv/bin/activate
PYTHONPATH=backend python -m pytest backend/tests -q
```

The current verified result is **26 passing tests**. Run the command again after code changes to confirm the current result.

## Synthetic Screening Evaluation

Run the evaluation script from the project root:

```bash
source .venv/bin/activate
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
- Configure persistent storage and database backups.
- Test the deployment and database configuration in a clean environment.

## Current Limitations

- AI assessments depend on the external Gemini service when live screening is used.
- Synthetic evaluation uses mocked assessments and does not establish real-world model accuracy.
- Screening scores are heuristic and should not be interpreted as calibrated probabilities.
- Docker Compose currently configures PostgreSQL only; the backend and frontend are started separately.
- Production deployment and HTTPS configuration must be verified separately.

## License

Add the appropriate license and ownership information before distributing the project.
