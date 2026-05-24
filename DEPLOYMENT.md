# Deployment Guide: GitHub + Vercel

This project is prepared as a monorepo:

```text
psx-ai-clean/
  api/index.py              # Vercel Python serverless entrypoint
  backend/main.py           # FastAPI application
  frontend/                 # React + Vite frontend
  vercel.json               # Vercel routing/build config
  requirements.txt          # Python dependencies for Vercel
```

## What Vercel Deploys

Vercel deploys two parts:

- Frontend: `frontend/package.json` is built with Vite and served as a static site.
- Backend: `api/index.py` imports the FastAPI app from `backend/main.py` and runs it as a Python serverless function.

Frontend requests use same-origin API paths:

```text
/api/market
/api/predict/OGDC
/api/chat
```

So on Vercel, you usually do not need to set `VITE_API_URL`.

## Required Environment Variables

In Vercel project settings, add:

```text
GEMINI_API_KEY=your_real_gemini_api_key
```

This is optional. If it is missing, the project still works with the local fallback chat logic.

Do not upload real `.env` files to GitHub.

## GitHub Setup

From the project root:

```bash
git init
git add .
git commit -m "Prepare PSX AI for Vercel deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

Before pushing, check that secrets are not staged:

```bash
git status
```

The `.gitignore` already excludes:

- `.env`
- `backend/.env`
- `frontend/.env`
- logs
- `node_modules`
- build folders
- Python cache

## Vercel Setup

1. Go to Vercel.
2. Import the GitHub repository.
3. Keep the project root as the repository root.
4. Vercel will read `vercel.json`.
5. Add `GEMINI_API_KEY` in Environment Variables if you want Gemini chat.
6. Deploy.

## Vercel Routes

The routing is defined in `vercel.json`.

Frontend build settings:

```json
{
  "installCommand": "npm --prefix frontend ci",
  "buildCommand": "npm --prefix frontend run build",
  "outputDirectory": "frontend/dist"
}
```

Backend rewrites:

```json
{
  "source": "/api/(.*)",
  "destination": "/api/index.py"
}
```

This sends all backend API calls to FastAPI.

Frontend routes are served from:

```text
frontend/dist
```

## Local Development

Backend:

```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Local Production Build Test

Frontend:

```bash
cd frontend
npm run build
```

Backend import test:

```bash
python -c "from api.index import app; print(app.title)"
```

Expected output:

```text
PSX AI API
```

## Notes

- Vercel serverless functions have execution time limits. Long PSX scraping or slow external APIs may occasionally timeout.
- The backend depends on live PSX pages. If PSX changes their HTML/API format, scraping functions may need updates.
- `frontend/.env.example` is for local development. On Vercel, same-origin `/api` routing is preferred.
