# Tamreena Web

Frontend + BFF (backend-for-frontend) for the Tamreena website. Sibling project to `Tamreena_AI` (the plan-generation service), `Nutrition-Plan-Generation`, and `Computer-Vision`.

## Setup

1. `cp .env.example .env`
2. Set `JWT_SECRET` to the **exact same value** as `Tamreena_AI`'s own `.env`'s `JWT_SECRET` -- this service's tokens must be verifiable by that repo's API. See `Tamreena_AI/docs/superpowers/specs/2026-07-25-bff-auth-handoff-design.md` for why.
3. Set `GOOGLE_OAUTH_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` to the same Google Cloud OAuth client ID (Credentials > OAuth 2.0 Client IDs) if you want real Google Sign-In to work. Leave blank to only use the dev-login bypass.
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

E2E (Playwright, requires the docker compose stack running with `ALLOW_DEV_LOGIN=true`):
```bash
npm install
npx playwright install --with-deps chromium
npx playwright test
```

## Status

Stage 1 of a multi-stage build (see `Tamreena_AI/docs/superpowers/specs/2026-07-25-website-mvp-design.md`): repo scaffold + real auth (Google Sign-In + dev-login) + the Sign In screen. Later stages add Home/Workout/Progress, Nutrition, and Exercises/Live Session screens.

**This is a dev-only stack as shipped** -- the frontend runs Vite's dev server (not a production build), and the default `.env` enables the dev-login bypass with wide-open CORS. Do not deploy this compose file as-is to a public-facing environment.
