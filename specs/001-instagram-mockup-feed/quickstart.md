# Quickstart: Instagram MockUp Experimental Reel Feed

**Feature**: [spec.md](spec.md)
**Date**: 2025-12-21

This quickstart describes how to run the app locally and exercise the feature end-to-end.

## Prerequisites

- Backend environment variable `ROCKET_API_KEY` must be set (any non-empty value for local development).
- **Optional**: Backend environment variable `OLLAMA_API_TOKEN` for AI comment generation (get your token from https://ollama.ai).
- Backend and frontend run as separate processes.
 - [`uv`](https://docs.astral.sh/uv/) installed for Python dependency management.

## Run the backend

From repository root:

- `cd backend`
- `uv sync`
- `ROCKET_API_KEY=dummy uv run uvicorn main:app --reload`

For AI comment generation, also set `OLLAMA_API_TOKEN`:
- `ROCKET_API_KEY=dummy OLLAMA_API_TOKEN=your_token uv run uvicorn main:app --reload`

Backend will:
- Create DB tables on startup (SQLite by default)
- Serve uploaded media from `/media` if the upload directory exists

## Run the frontend

From repository root:

- `cd frontend`
- `npm install`
- `npm run dev`

Frontend proxies `/api` and `/media` to the backend during development.

## Researcher workflow (US1/US3)

1. Open the app and **register a new account** (or use existing credentials).
2. Sign in.
3. Create a project.
3. Create an experiment under the project.
4. Add at least one media item (upload or ingest via supported Instagram URL).
5. Reorder media items in the experiment overview as needed.
6. Preview the feed.

## Participant workflow (US2/US4)

1. Copy the experiment’s public link and add any tracking parameters. Ensure you include the project’s configured “Query String Key” parameter (default: `participantId`), e.g. `?participantId=abc&source=x`.
2. Open the link in an incognito window or another browser.
3. Verify reels autoplay and navigation works.
4. Refresh the page mid-session; confirm the session resumes and the timer continues (not reset).
5. Wait for the time limit to elapse to reach the end screen.
6. Click the continue button and confirm all incoming query parameters are forwarded unchanged to the redirect destination.

## Comments workflow (US6)

1. As a researcher, open a media item’s comment editor.
2. Set exactly one pinned comment (optionally including a link).
3. Add additional pre-seeded comments and reorder them.
4. **AI Generation (optional)**: Click "Generate Comments with AI" to auto-generate contextual comments based on the video caption:
   - Select the number of comments (3, 5, 10, or 15)
   - Choose the tone (mixed/realistic, positive, or negative/critical)
   - **Note**: Requires `OLLAMA_API_TOKEN` environment variable to be set
5. In the participant feed, verify comments appear consistently.
6. Click the pinned comment link and verify the click is recorded as an interaction event.

## Results workflow (US5)

1. Run a small pilot with a few participant sessions.
2. Open the experiment results dashboard.
3. Select one or more participant sessions.
4. Export as:
   - CSV (aggregated) and/or
   - JSON (full-detail events)

## Tests

Backend:

- `cd backend`
- `uv sync`
- `ROCKET_API_KEY=dummy uv run pytest`

Frontend:

- `cd frontend`
- `npm test`
