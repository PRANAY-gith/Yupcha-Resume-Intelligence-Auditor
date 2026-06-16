Resume Intelligence Auditor

This project is a full-stack application that analyzes a candidate’s resume against a job description and generates a hiring recommendation using AI.

Instead of just giving a score, the system tries to explain why a candidate is a good or bad fit by mapping job requirements to actual evidence from the resume.

⸻

What it does

* Upload a resume (PDF or text)
* Upload a job description
* Run an AI-based evaluation
* Generate:
    * requirement vs evidence matching
    * missing skills / gaps
    * hiring recommendation (hire / no-hire / maybe)
    * confidence score
    * interview questions

The goal is to make the output understandable and explainable, not just a black-box result.

⸻

Tech stack

Frontend

* Next.js 14
* TypeScript
* TailwindCSS

Backend

* FastAPI (Python)

Database

* PostgreSQL

AI

* Gemini API (used for structured responses)

⸻

How the system works

There’s a simple pipeline behind the scenes:

1. Extract skills and experience from the resume
2. Extract requirements from the job description
3. Compare both and find matches
4. Identify missing or weak areas
5. Generate risks based on gaps
6. Create interview questions
7. Score the candidate
8. Generate a final summary and store everything

Each step returns structured JSON so it can be stored and reused later.

⸻

Backend

The backend is built using FastAPI and handles most of the logic.

Responsibilities:

* managing candidates
* handling uploads (resume + job description)
* running the AI workflow
* storing results in the database
* returning reports to the frontend

Structure

backend/
  app/
    models/
    schemas/
    routes/
    services/
    db.py
    main.py

⸻

Frontend

The frontend is built with Next.js and provides a simple interface.

You can:

* upload files
* trigger the audit
* view the results in a readable format

Structure

frontend/
  app/
  components/
  lib/

⸻

API

Main endpoints:

Candidates:

* POST /candidates
* GET /candidates

Uploads:

* POST /candidates/{id}/resume
* POST /candidates/{id}/job-description

Audit:

* POST /candidates/{id}/audit
* GET /candidates/{id}/report

⸻

Database

The project uses PostgreSQL with the following tables:

* candidates
* resumes
* job_descriptions
* audit_reports
* evidence_mappings

Each report stores:

* recommendation
* confidence score
* summary
* requirement → evidence mapping

⸻

Running locally

Backend

cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

Create a .env file:

DATABASE_URL=postgresql://user:password@localhost/resume_db
GEMINI_API_KEY=your_api_key

Run the server:

uvicorn app.main:app --reload

⸻

Frontend

cd frontend
npm install
npm run dev

⸻
