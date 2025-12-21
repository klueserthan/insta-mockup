# Research: Instagram MockUp Experimental Reel Feed

**Feature**: [spec.md](spec.md)
**Date**: 2025-12-21

This document resolves planning-time ambiguities and records key design decisions.

## Decisions

### 1) Supported “external post URLs”

- **Decision**: Treat “external post URL ingestion” as Instagram-only (reels/posts) via the existing RocketAPI integration.
- **Rationale**: The repo already includes RocketAPI-based Instagram ingest. Expanding to other platforms introduces new dependencies, auth models, and legal/compliance considerations.
- **Alternatives considered**:
  - Generic URL scraping/downloading (rejected: reliability and compliance risk)
  - Support multiple platforms (rejected: scope increase)

### 2) Experiment kill switch behavior

- **Decision**: Add a per-experiment active/inactive flag controlled by the researcher. When inactive, the public feed link does not start sessions and shows a friendly “study not active” message.
- **Rationale**: Matches the spec’s “kill switch” requirement; provides immediate stop capability without rotating URLs.
- **Alternatives considered**:
  - Rotate the public URL token on kill (rejected: harder to communicate, breaks already-distributed links)
  - Return a generic 404 always (rejected: spec calls for a friendly message)

### 3) Session identity + resume semantics

- **Decision**: Session resumption is keyed by a stable participant identifier derived from the public link’s query string: the project’s configured **Query String Key** (`Project.queryKey`) determines which query parameter name contains the participant identifier value (default: `participantId`). If the participant returns with the same participant identifier value and the session is still within the time limit, the system resumes the existing session and continues the timer.
- **Rationale**: Required by FR-014 (“timer must not reset”). Using the project-configured key matches current domain configuration and keeps participant identity stable across reloads/devices without relying on cookies.
- **Alternatives considered**:
  - Key by cookie only (rejected: not robust across devices/browsers)
  - Always start a new session on reload (rejected: conflicts with FR-014)
  - Hard-code a single query parameter name like `participantId` (rejected: the key name is configured per project)

### 4) Redirect tracking parameters

- **Decision**: “Whatever comes in also goes out”: the end-screen redirect MUST forward all incoming query parameters unchanged (keys and values) to the redirect destination.
- **Rationale**: Matches clarified requirement; avoids coupling to special query keys.
- **Alternatives considered**:
  - Add or override parameters (rejected: violates pass-through requirement)

### 5) Media ordering, locking, and randomization

- **Decision**: Use an explicit ordering model with per-media position plus lock constraints. Locked items must appear at their specified positions; remaining items can be randomized per participant session.
- **Rationale**: Preserves the “randomized with locks” requirement while supporting “reorder in feed overview” as the mechanism to set positions.
- **Alternatives considered**:
  - Fully deterministic ordering for all items (rejected: conflicts with “randomized with locks”)
  - Pure randomization with only first/last locks (rejected: insufficient for “place at appropriate location”)

### 6) Pinned comment and link click tracking

- **Decision**: Allow exactly one pinned comment per media item. If it contains a link, clicking opens the link in a new window/tab and records a dedicated interaction event that includes the target URL.
- **Rationale**: Matches FR-016 and enables measuring exposure/click-through.
- **Alternatives considered**:
  - Multiple pinned comments (rejected: spec says “one”)
  - Non-clickable links (rejected: spec explicitly requires clickable link)

### 7) Pre-seeded comments (manual + assistant)

- **Decision**: Store pre-seeded comments per media item with an explicit order. Provide two workflows:
  - Manual creation/editing/reordering
  - “Assistant” generation that proposes comments from media + caption; researcher must review and accept before saving.
- **Rationale**: Matches US6 + FR-017/FR-018 while keeping the “researcher in control” requirement.
- **Alternatives considered**:
  - Auto-publish generated comments (rejected: violates explicit acceptance)

### 8) Results export formats

- **Decision**: Provide both CSV and JSON exports:
  - CSV: one row per participant-session with key aggregates
  - JSON: full per-participant, per-interaction detail
- **Rationale**: Matches the clarified requirement (“C”) and supports both spreadsheet workflows and detailed analysis.
- **Alternatives considered**:
  - CSV only (rejected)
  - JSON only (rejected)

## Notes / Constraints

- Authentication: researcher configuration remains authenticated; public feed remains participant-accessible by public URL.
- Media safety: validate uploads and keep file operations within the configured upload directory.
- UI consistency: any new frontend elements must use the existing design system and shared components.
