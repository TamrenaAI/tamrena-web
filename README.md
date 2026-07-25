# Tamreena Web

Frontend + BFF (backend-for-frontend) for the Tamreena website. Sibling project to `Tamreena_AI` (the plan-generation service), `Nutrition-Plan-Generation`, and `Computer-Vision`.

## Setup

1. `cp .env.example .env`
2. Set `JWT_SECRET` to the **exact same value** as `Tamreena_AI`'s own `.env`'s `JWT_SECRET` -- this service's tokens must be verifiable by that repo's API. See `Tamreena_AI/docs/superpowers/specs/2026-07-25-bff-auth-handoff-design.md` for why.
3. Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` to valid AWS credentials with access to the DynamoDB table -- the backend now stores users in DynamoDB, and startup will crash-loop without real credentials.
4. `docker compose up --build -d`

## Ports

- Backend: `http://localhost:8010`
- Frontend: `http://localhost:5174`
- MongoDB: `localhost:27018` (this service's own database, separate from Tamreena_AI's)

## Testing

Backend:
```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

E2E (Playwright, requires the docker compose stack running):
```bash
npm install
npx playwright install --with-deps chromium
npx playwright test
```

## Status

Stage 1 of a multi-stage build (see `Tamreena_AI/docs/superpowers/specs/2026-07-25-website-mvp-design.md`): repo scaffold + real auth (username/password signup and login) + the Sign In/Sign Up screen. Later stages add Home/Workout/Progress, Nutrition, and Exercises/Live Session screens.

**This is a dev-only stack as shipped** -- the frontend runs Vite's dev server (not a production build), and the backend has wide-open CORS (`allow_origins=["*"]`). Do not deploy this compose file as-is to a public-facing environment.
