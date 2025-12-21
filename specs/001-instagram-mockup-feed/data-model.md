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

### Project

- Represents a container for experiments.
- Key fields:
  - `id`
  - `researcherId` (owner)
  - `name`
  - `queryKey` (the query-string parameter name that contains the stable participant identifier value; default: `participantId`)
  - `createdAt`, `updatedAt` (if tracked)
- Relationships:
  - Belongs to one Researcher
  - Has many Experiments

### Experiment (Feed)

- Represents a participant-facing reel feed with settings and a public link.
- Key fields:
  - `id`
  - `projectId`
  - `name`
  - `publicUrlToken` (public link identifier)
  - `isActive` (kill switch)
  - `timeLimitSeconds`
  - `endScreenMessage`
  - `redirectUrl`
  - `randomizationSeed`
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
    - `lockedPosition` (bool)
- Relationships:
  - Belongs to one Experiment
  - Belongs to one Social Persona
  - Has many Pre-seeded Comments

### Pre-seeded Comment

- Represents a configured comment for a specific media item.
- Key fields:
  - `id`
  - `mediaItemId`
  - `text`
  - `linkUrl` (optional)
  - `isPinned` (boolean; at most one pinned per media item)
  - `position` (order among comments)
- Relationships:
  - Belongs to one Media Item

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
  - If `isActive=false`, public feed must not start new sessions.
- Upload safety:
  - Enforce file type allowlist and max size (50MB).
- Pinned comment:
  - At most one `Pre-seeded Comment` per media item may have `isPinned=true`.
- Comment ordering:
  - Positions should be contiguous per media item for stable ordering.
- Session resume:
  - A participant reopening the feed with the same `participantKey` resumes the same session while within the experiment time limit.

## State Transitions

- Experiment:
  - Active → Inactive via kill switch
  - Inactive → Active (optional if re-enabled)
- Participant Session:
  - Created → Active → Ended (by timer expiry or participant completion)
