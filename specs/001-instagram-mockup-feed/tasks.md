# Tasks: Instagram MockUp Experimental Reel Feed

**Input**: Design documents from `/specs/001-instagram-mockup-feed/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Project Structure (per plan.md)**: `backend/` (FastAPI + SQLModel) and `frontend/` (React/Vite)

**Note on Tests**: Backend work follows the repo constitution (pytest red-green-refactor). Test work MUST precede implementation for each backend change: (1) write failing pytest in `backend/tests` → (2) implement behavior → (3) refactor. Quality gates (ruff format, pyright, pytest) must pass before treating any backend task as complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure developers can run, verify, and iterate quickly.

- [ ] T001 Confirm quickstart steps are correct in specs/001-instagram-mockup-feed/quickstart.md
- [ ] T002 [P] Confirm API contract scope matches implementation surface in specs/001-instagram-mockup-feed/contracts/openapi.yaml
- [ ] T003 [P] Confirm data model aligns with current DB models in specs/001-instagram-mockup-feed/data-model.md and backend/models.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core cross-story plumbing for identity, sessioning, and public vs researcher auth boundaries.

- [ ] T004 Define/confirm the project “Query String Key” behavior in backend/models.py and backend/routes/projects.py
- [ ] T005 Implement a single source of truth for extracting participant identity from request query params (Project.queryKey) in backend/routes/feed.py
- [ ] T006 [P] Ensure participant routes are public-only and bypass researcher auth (feed + interactions) in backend/main.py and backend/routes/feed.py
- [ ] T007 [P] Ensure all researcher configuration routes remain session-authenticated in backend/main.py and backend/auth.py
- [ ] T008 Normalize participant/session/interaction data model fields used by feed + logging in backend/models.py and backend/routes/interactions.py
- [ ] T008b [P] Ensure experiment `isActive` toggle is exposed in the experiment editor UI so researchers can enable/disable the feed in frontend/src/pages/Dashboard.tsx and frontend/src/components/dashboard/MediaEditor.tsx
- [ ] T009 Add kill-switch enforcement: public feed endpoint rejects requests if `experiment.isActive == False` and returns a friendly "study not active" message in backend/routes/feed.py
- [ ] T009a Add consistent error response shapes/messages for participant-facing failures (inactive feed, empty feed, invalid token) in backend/routes/feed.py
- [ ] T010 [P] Align frontend API types with backend camelCase payloads in frontend/src/lib/api-types.ts
- [ ] T052 Implement JWT-based researcher auth (password hashing with Argon2, token issuance, and `get_current_researcher` dependency) aligned with plan.md and contracts/openapi.yaml in backend/auth.py and backend/main.py
- [ ] T053 Ensure all researcher-only routes require JWT Bearer auth via `get_current_researcher` dependency in backend/routes/projects.py, backend/routes/experiments.py, backend/routes/videos.py, backend/routes/comments.py, backend/routes/interactions.py, backend/routes/storage.py, backend/routes/instagram.py, and backend/routes/accounts.py
- [ ] T054 [P] Verify participant-facing feed and interaction endpoints remain public (no JWT required) and add pytest coverage for authorized vs unauthorized access in backend/routes/feed.py, backend/routes/interactions.py, and backend/tests/test_auth.py

**Checkpoint**: After Phase 2, user stories can be implemented independently.

---

## Phase 3: User Story 1 - Researcher creates and previews a basic reel experiment (Priority: P1) 🎯 MVP

**Goal**: Researcher can create a project + experiment, add a media item, reorder in overview, and preview the feed.

**Independent Test**: Create project → experiment → upload media → open preview link; verify reel-style preview works and reflects ordering changes.

- [ ] T011 [US1] Ensure project create/list/edit flows exist and match spec expectations in backend/routes/projects.py
- [ ] T012 [US1] Ensure experiment create/list/edit flows exist and match spec expectations in backend/routes/experiments.py
- [ ] T013 [P] [US1] Ensure dashboard creates/edits projects and experiments in frontend/src/pages/Dashboard.tsx
- [ ] T014 [P] [US1] Ensure dashboard API calls include cookies and match backend routes in frontend/src/lib/queryClient.ts
- [ ] T015 [US1] Implement/align experiment preview link generation and routing in frontend/src/App.tsx and frontend/src/pages/Dashboard.tsx
- [ ] T016 [P] [US1] Implement/align media overview reorder UI (feed overview) in frontend/src/components/dashboard/MediaManager.tsx
- [ ] T017 [US1] Persist reordered media order to backend reorder endpoint in backend/routes/videos.py
- [ ] T018 [US1] Ensure preview respects saved ordering (subject to lock/randomization rules) in backend/routes/feed.py

---

## Phase 4: User Story 2 - Participant experiences a timed experimental feed and reaches the end screen (Priority: P1)

**Goal**: Participant opens public link, sees full-screen vertical reel feed with autoplay; timer expires → end screen.

**Independent Test**: Open public link in incognito, consume feed until timer elapses, confirm end screen appears with configured message + CTA.

- [ ] T019 [US2] Implement/align public feed delivery payload (experiment settings + ordered videos) in backend/routes/feed.py
- [ ] T020 [US2] Enforce experiment time limit and stop feed when reached in frontend/src/pages/ReelsFeed.tsx
- [ ] T021 [US2] Ensure end screen route renders configured message and CTA in frontend/src/pages/EndScreen.tsx
- [ ] T022 [US2] Implement session resume so refresh/reopen continues timer (no reset) in frontend/src/pages/ReelsFeed.tsx
- [ ] T023 [US2] Ensure session resume uses participant identity from Project.queryKey (not hard-coded) in frontend/src/pages/ReelsFeed.tsx
- [ ] T024 [US2] Log participant interactions and heartbeats against the resumed session in backend/routes/interactions.py

---

## Phase 5: User Story 3 - Researcher ingests and manages media via uploads and external URLs (Priority: P2)

**Goal**: Researcher can add multiple media items via upload and Instagram URL ingest, edit metadata, and lock items to positions.

**Independent Test**: Upload multiple media + ingest one URL; set captions/accounts/metrics; lock first/last; verify feed behavior.

- [ ] T025 [US3] Ensure upload endpoint returns usable media reference/URL for the frontend in backend/routes/storage.py
- [ ] T026 [P] [US3] Ensure ObjectUploader uploads media and updates UI state in frontend/src/components/ObjectUploader.tsx
- [ ] T027 [US3] Implement/align Instagram URL ingest endpoint behavior in backend/routes/instagram.py
- [ ] T028 [P] [US3] Wire ingest UI into media editor flow in frontend/src/components/dashboard/MediaEditor.tsx
- [ ] T029 [US3] Ensure social persona/account selection and display matches existing patterns in backend/routes/accounts.py and frontend/src/components/dashboard/MediaEditor.tsx
- [ ] T030 [US3] Persist engagement metrics fields (likes/comments/shares) through API and UI in backend/routes/videos.py and frontend/src/components/dashboard/MediaEditor.tsx
- [ ] T031 [US3] Implement/align lock semantics (locked items fixed to positions) in backend/routes/videos.py and backend/routes/feed.py

---

## Phase 6: User Story 5 - Researcher reviews and exports experiment results (Priority: P2)

**Goal**: Researcher can view results dashboard, inspect metrics, and export selected sessions as CSV or JSON.

**Independent Test**: Run a few sessions, open results dashboard, select sessions, download CSV and JSON successfully.

- [ ] T032 [US5] Define/align results endpoints and response payloads in backend/routes/interactions.py and specs/001-instagram-mockup-feed/contracts/openapi.yaml
- [ ] T033 [US5] Implement CSV export generation and headers in backend/routes/interactions.py
- [ ] T034 [US5] Implement JSON export generation (full-detail events) in backend/routes/interactions.py
- [ ] T035 [P] [US5] Add results dashboard UI for selecting an experiment and viewing metrics in frontend/src/pages/Dashboard.tsx
- [ ] T036 [P] [US5] Add export UI (CSV/JSON download for selected sessions) in frontend/src/pages/Dashboard.tsx

---

## Phase 7: User Story 4 - Researcher shares experiment link with preserved tracking parameters (Priority: P3)

**Goal**: Redirect from end screen forwards all inbound query parameters unchanged.

**Independent Test**: Open public link with multiple query params → reach end screen → click CTA → destination has same params and values.

- [ ] T037 [US4] Ensure end screen redirect preserves all inbound query params unchanged in frontend/src/pages/EndScreen.tsx
- [ ] T038 [US4] Ensure feed-to-end-screen navigation retains the participant’s original query string (no drops/overwrites) in frontend/src/pages/ReelsFeed.tsx

---

## Phase 8: User Story 6 - Researcher pre-seeds comments for media items (Priority: P3)

**Goal**: Researcher can configure pinned + pre-seeded comments, optionally generate suggestions, and participants see consistent comment threads.

**Independent Test**: Add pinned + pre-seeded comments (manual + assistant suggestions accepted), preview feed, verify ordering and link click logging.

- [ ] T039 [US6] Implement/align CRUD for pre-seeded comments and ordering in backend/routes/comments.py
- [ ] T040 [US6] Implement/align pinned comment upsert behavior (exactly one pinned per video) in backend/routes/comments.py
- [ ] T041 [P] [US6] Implement/align comment manager UI (manual add/edit/reorder) in frontend/src/components/CommentsManager.tsx
- [ ] T042 [P] [US6] Implement/align participant comment overlay rendering (pinned differentiation, ordering) in frontend/src/components/CommentsOverlay.tsx
- [ ] T043 [US6] Implement assistant suggestion endpoint behavior and schema in backend/routes/comments.py
- [ ] T044 [P] [US6] Implement assistant suggestions UX (review/edit/accept) in frontend/src/components/CommentsManager.tsx
- [ ] T045 [US6] Log pinned-comment link clicks as interaction events (include target URL) in frontend/src/pages/ReelsFeed.tsx and backend/routes/interactions.py

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Hardening and consistency across stories.

- [ ] T046 [P] Ensure all new frontend elements use existing design system components and tokens in frontend/src/components/ui/* and frontend/src/pages/*
- [ ] T047 Ensure kill switch messaging is friendly and non-technical across participant views in frontend/src/pages/ReelsFeed.tsx and frontend/src/pages/EndScreen.tsx
- [ ] T048 Ensure error states for ingest/upload/empty feeds are user-clear in frontend/src/components/dashboard/MediaEditor.tsx and frontend/src/pages/ReelsFeed.tsx
- [ ] T049 Validate quickstart end-to-end steps by exercising specs/001-instagram-mockup-feed/quickstart.md
- [ ] T050 Run backend quality gates (ruff/pyright/pytest) using commands documented in specs/001-instagram-mockup-feed/quickstart.md
- [ ] T051 Run frontend tests using commands documented in specs/001-instagram-mockup-feed/quickstart.md

---

## Dependencies & Execution Order

### User Story Completion Order (suggested)

1. **US1 (P1)** Researcher create + preview (establishes authoring + preview loop)
2. **US2 (P1)** Participant timed feed + end screen (core experiment experience)
3. **US3 (P2)** Upload + ingest + lock semantics (richer content and experimental control)
4. **US5 (P2)** Results dashboard + export (analysis and reporting)
5. **US4 (P3)** Redirect param pass-through (tracking integrity)
6. **US6 (P3)** Comments pre-seeding + assistant + link click logging (social context)

### Cross-Story Dependencies

- **Phase 2 (Foundational)** blocks all stories (participant identity source-of-truth + auth boundaries).
- **US2** depends on having an experiment and at least one media item (typically created via **US1**).
- **US4** depends on **US2** end screen and CTA behavior.
- **US5** depends on interaction/session logging from **US2**.

## Parallel Execution Examples

### US1 Parallel Opportunities

- [P] Frontend dashboard wiring in frontend/src/pages/Dashboard.tsx
- [P] Media overview reorder UI in frontend/src/components/dashboard/MediaManager.tsx
- Backend reorder persistence in backend/routes/videos.py

### US2 Parallel Opportunities

- [P] End screen UX in frontend/src/pages/EndScreen.tsx
- Participant timer + resume logic in frontend/src/pages/ReelsFeed.tsx
- Backend interaction/heartbeat logging in backend/routes/interactions.py

### US3 Parallel Opportunities

- [P] Upload UI in frontend/src/components/ObjectUploader.tsx
- [P] Media editor UI wiring in frontend/src/components/dashboard/MediaEditor.tsx
- Backend upload/ingest endpoints in backend/routes/storage.py and backend/routes/instagram.py

### US5 Parallel Opportunities

- [P] Results dashboard UI in frontend/src/pages/Dashboard.tsx
- Backend exports in backend/routes/interactions.py

### US6 Parallel Opportunities

- [P] Comment manager UI in frontend/src/components/CommentsManager.tsx
- [P] Participant overlay rendering in frontend/src/components/CommentsOverlay.tsx
- Backend comments endpoints in backend/routes/comments.py

---

## Implementation Strategy

### MVP Scope

- **MVP = US1 only** (researcher can create and preview an experiment).

### Incremental Delivery

- Deliver in priority order: US1 → US2 → US3 → US5 → US4 → US6.
- After each user story, validate its independent test scenario before proceeding.
