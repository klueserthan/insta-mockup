# Data Model: Instagram MockUp Experimental Reel Feed

**Feature**: [spec.md](spec.md)
**Date**: 2025-12-21

This document describes the entities, relationships, and validation rules implied by the feature specification.

## Entities

### Researcher

- Represents an authenticated user who configures projects/experiments.
- Relationships:
  - Owns many Projects
  - Owns many Social Personas

### Token Response (Auth)

- Represents a successful authentication response.
- Key fields:
  - `accessToken` (JWT bearer token issued upon login)
  - `tokenType` (always "bearer")
  - Optional: `expiresIn` (seconds until expiration, typically 1800 for 30 min default)
- Created by: Login endpoint upon valid researcher credentials
- Consumed by: Frontend stores in memory (not localStorage/sessionStorage for security) and includes in subsequent requests as `Authorization: Bearer <token>`

### Project

- Represents a container for experiments.
- Key fields:
  - `id`
  - `researcherId` (owner)
  - `name`
  - `queryKey` (the query-string parameter name that contains the stable participant identifier value; default: `participantId`)
  - `timeLimitSeconds` (time limit applied to experiments)
  - `endScreenMessage` (message shown at end of experiments)
  - `redirectUrl` (URL to redirect to after experiments)
  - `randomizationSeed` (seed for randomizing media order)
  - `persistTimer` (whether timer persists across page reloads)
  - `showUnmutePrompt` (whether to show unmute prompt)
  - `createdAt`, `updatedAt` (if tracked)
- Relationships:
  - Belongs to one Researcher
  - Has many Experiments

### Experiment (Feed)

- Represents a participant-facing reel feed with a public link.
- Key fields:
  - `id`
  - `projectId`
  - `name`
  - `publicUrlToken` (public link identifier)
  - `isActive` (kill switch for this experiment)
- Relationships:
  - Belongs to one Project
  - Has many Media Items
  - Has many Participant Sessions

### Social Persona

- Represents an account/profile used to present a media item.
- Key fields:
  - `id`
  - `researcherId` (owner)
  - `username` (handle)
  - `displayName`
  - `avatarMediaRef` (locally stored avatar)
- Relationships:
  - Belongs to one Researcher
  - Used by many Media Items

### Media Item (Reel)

- Represents a single piece of reel content shown to participants.
- Key fields:
  - `id`
  - `experimentId`
  - `mediaRef` (stored file reference)
  - `caption`
  - `socialPersonaId`
  - Engagement metrics (likes, comments, shares, etc.)
  - Ordering/lock fields:
    - `position` (base ordering)
    - `isLocked` (boolean; if true, position is locked and not randomized)
- Relationships:
  - Belongs to one Experiment
  - Belongs to one Social Persona
  - Has many Pre-seeded Comments

### Pre-seeded Comment

- Represents a configured comment for a specific media item.
- Key fields:
  - `id`
  - `mediaItemId`
  - `socialPersonaId` (the persona/account authoring this comment)
  - `text`
  - `linkUrl` (optional)
  - `isPinned` (boolean; at most one pinned per media item)
  - `position` (order among comments)
- Relationships:
  - Belongs to one Media Item
  - Belongs to one Social Persona

### Participant Session

- Represents a participant’s session for an experiment; may span multiple page loads.
- Key fields:
  - `id`
  - `experimentId`
  - `participantKey` (stable identifier used for resume; equals the value of the query parameter named by the parent Project’s `queryKey`)
  - `startedAt`, `endedAt` (or equivalent)
  - `elapsedMs` (or derivable from timestamps)
- Relationships:
  - Belongs to one Experiment
  - Has many Interaction Events
  - Has many View Sessions / Heartbeats (if modeled separately)

### Interaction Event

- Represents a single logged action.
- Key fields:
  - `id`
  - `participantSessionId`
  - `mediaItemId` (optional for global events)
  - `type` (canonical event types such as `view_start`, `view_end`, `next`, `previous`, `scroll_up`, `scroll_down`, `like`, `unlike`, `follow`, `unfollow`, `reshare`, `pinned_comment_link_click`)
  - `timestamp`
  - `data` (structured payload for additional details; engagement events MUST at least capture the action taken and timestamp)
- Relationships:
  - Belongs to one Participant Session
  - Optionally references a Media Item

## Validation Rules

- Experiment kill switch:
  - If `isActive=false`, public feed must not start new sessions for that experiment.
- Upload safety:
  - Enforce file type allowlist and max size (50MB).
- Pinned comment:
  - At most one `Pre-seeded Comment` per media item may have `isPinned=true`.
- Comment ordering:
  - Positions should be contiguous per media item for stable ordering.
- Session resume:
  - A participant reopening the feed with the same `participantKey` resumes the same session while within the project's time limit.
- Lock behavior:
  - Media items with `isLocked=true` maintain their position; unlocked items may be randomized based on project's `randomizationSeed`.

## State Transitions

- Experiment:
  - Active → Inactive via kill switch (per experiment)
  - Inactive → Active (optional if re-enabled)
- Participant Session:
  - Created → Active → Ended (by timer expiry or participant completion)
