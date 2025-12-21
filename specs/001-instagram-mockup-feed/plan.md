# Implementation Plan: Instagram MockUp Experimental Reel Feed

**Branch**: `001-instagram-mockup-feed` | **Date**: 2025-12-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-instagram-mockup-feed/spec.md`

## Summary

Deliver an Instagram-like reels feed for research experiments: authenticated researcher CRUD for projects/experiments/media/comments and a participant-facing public feed that logs interactions, enforces a time limit, supports session resume (timer continues), supports a per-experiment kill switch, and forwards all inbound query parameters unchanged on redirect.

Key decision: participant identity is derived from the query parameter whose name is configured by the project’s **Query String Key** (`Project.queryKey`, default `participantId`).

## Technical Context

**Language/Version**: Python 3.13 (backend), TypeScript/React (frontend)
**Primary Dependencies**:
- Backend: FastAPI, SQLModel, Starlette SessionMiddleware, httpx/requests, rocketapi
- Frontend: React + Vite, Wouter, TanStack Query, shadcn/ui-style components
**Storage**: SQLModel DB (SQLite default, Postgres supported via `DATABASE_URL`), filesystem for uploads in `UPLOAD_DIR` served at `/media`
**Testing**: pytest (backend), Vitest + Testing Library (frontend)
**Linting**: pyright (backend)
**Formatting**: ruff
**Target Platform**: Local dev + typical Linux server deployment
**Project Type**: Web application (separate `backend/` + `frontend/`)
**Performance Goals**: MVP research usage; prioritize correctness and data integrity over throughput
**Constraints**: Preserve existing session-cookie auth patterns; preserve camelCase payloads; redirect must preserve all inbound query params unchanged
**Scale/Scope**: Single-researcher/dev scale; multiple experiments with tens–hundreds of participant sessions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Backend work plans MUST start with tests (pytest) before implementation and include ruff + pyright in the quality gate.
- Plans must preserve existing frontend-defined behavior: camelCase payloads, session-cookie auth (`credentials: include`), and current routes/redirects.
- All backend routes must require authenticated access (session-based) for researcher-owned resources; participant-facing endpoints (feed, interaction logging) are scoped exceptions gated by experiment public_url token (see Complexity Tracking below).
- Any data mutation must account for researcher ownership checks using existing helpers; seeded dev user flow must remain usable.
- Media handling must respect validator limits (50MB, allowed extensions) and keep uploads within `UPLOAD_DIR` served at `/media`; RocketAPI ingest needs `ROCKET_API_KEY`.
- Frontend plans MUST use the existing design system and styling conventions (shared components, utility classes, spacing, and color tokens); avoid introducing bespoke visual patterns unless explicitly extending the design system.

## Project Structure

### Documentation (this feature)

```text
specs/001-instagram-mockup-feed/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── main.py
├── models.py
├── routes/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── pages/
└── test/
```

**Structure Decision**: Use the existing split `backend/` FastAPI app and `frontend/` Vite/React app.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Public participant feed and interaction logging cannot use researcher session-cookie auth | Participants must access `/feed/:publicUrlToken` without accounts (FR-008), and session resume requires a stable participant identifier from the public link | Forcing participant login/cookies breaks the “no account” requirement and is not robust across devices/browsers; the public URL token already scopes access |

The public feed endpoint (/feed/{publicUrlToken}) and related logging endpoints are treated as anonymous, link-based access for participants; no session-cookie auth or account creation is required.

## Phase 0: Research (complete)

- Outputs: [research.md](research.md)
- Key resolved ambiguity: session resume identity comes from the project-configured Query String Key (`Project.queryKey`).

## Phase 1: Design & Contracts (complete)

- Data model: [data-model.md](data-model.md)
- API contract draft: [contracts/openapi.yaml](contracts/openapi.yaml)
- Quickstart: [quickstart.md](quickstart.md)

## Phase 2: Implementation Plan (high level)

1. Backend: extend/align models and feed delivery so that participant identity is read from query parameter named by `Project.queryKey` (default `participantId`), and session resume uses that value.
2. Backend: ensure kill switch (`Experiment.isActive`) disables public feed and prevents starting sessions.
3. Backend: log interactions and heartbeats against the resumed session; ensure results export supports CSV + JSON.
4. Frontend: ensure feed route reads the configured query key value and includes it consistently when logging interactions, while preserving style/design system.
5. Quality gates: add/adjust pytest coverage first (TDD), then implement; run ruff + pyright + pytest; run frontend tests if UI logic changes.
