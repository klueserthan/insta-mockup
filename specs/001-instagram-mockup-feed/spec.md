# Feature Specification: Instagram MockUp Experimental Reel Feed

**Feature Branch**: `001-instagram-mockup-feed`  
**Created**: 2025-12-21  
**Status**: Draft  
**Input**: User description: "Implement Instagram MockUp WebApp for experimental reel feeds: minimal auth, layered projects→feeds→media, timed randomized feed with locks, ingest via uploads/Instagram URLs, realistic reel UX, and redirect with preserved query params."

## Clarifications

### Session 2025-12-21

- Q: What format(s) should experiment result exports use? → A: Provide both CSV (per participant-session aggregate) and JSON (full-detail per-participant events).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Researcher creates and previews a basic reel experiment (Priority: P1)

A researcher signs in, creates a new project and a single experiment under that project, uploads at least one short-form media item, configures minimal default settings, and previews the resulting reel-style feed to experience it as a participant would.

**Why this priority**: This is the smallest slice that delivers value to researchers: the ability to define and preview an Instagram-like reel feed for a study without involving external participants.

**Independent Test**: Can be fully tested by having a new researcher create a project, create an experiment, upload one media item, open a preview link, and confirm the preview behaves like a vertical, swipeable, autoplaying reel with basic metadata.

**Acceptance Scenarios**:

1. **Given** a signed-in researcher with no existing projects, **When** they create a project, add an experiment, upload a valid media file, and open the preview, **Then** they see a vertically oriented reel view that automatically plays the media with caption and account details.
2. **Given** a signed-in researcher viewing the preview, **When** they move to the next or previous media item using the primary navigation gesture, **Then** the feed advances smoothly between items without requiring authentication again.
3. **Given** a signed-in researcher viewing the experiment’s media overview, **When** they reorder media items by moving them to new positions in the list and save, **Then** the previewed feed reflects this updated order (subject to any locks or randomization rules) without requiring them to recreate the media.

---

### User Story 2 - Participant experiences a timed experimental feed and reaches the end screen (Priority: P1)

A participant opens a public experiment link on their device, experiences a sequence of reels with autoplay and progress indicators, and when the configured time limit is reached, is shown an end screen with instructions and a clear button to continue to an external survey or follow-up activity.

**Why this priority**: This scenario represents the core experimental experience and is essential for running real studies with participants.

**Independent Test**: Can be fully tested by distributing a public experiment link to a test participant, having them watch reels until the timer expires, and verifying that the end screen appears with the correct message and external link.

**Acceptance Scenarios**:

1. **Given** a published experiment with a non-zero time limit and at least one media item that is marked as active, **When** a participant opens the public link, **Then** they see a reel-style feed that starts playing automatically without requiring sign-in.
2. **Given** a participant viewing the feed, **When** the configured experiment time limit elapses, **Then** the feed stops advancing, an end screen appears with the configured message, and a clear call-to-action button is visible.
3. **Given** an experiment that a researcher has explicitly deactivated using a kill switch, **When** a participant opens the public link, **Then** they do not see the feed and instead see a friendly, non-technical message that the study is no longer active.

---

### User Story 3 - Researcher ingests and manages media via uploads and external URLs (Priority: P2)

A signed-in researcher adds multiple media items to an experiment using both direct file uploads and supported external post URLs, manages associated social persona information and engagement metrics, and locks specific items to the beginning or end of the feed.

**Why this priority**: Researchers need a flexible way to populate experiments with realistic-looking content and control which items appear first or last to enforce study design.

**Independent Test**: Can be fully tested by having a researcher upload several media files, ingest at least one item from a supported external URL, adjust captions, accounts, and metrics, lock one item to the first position and one to the last, and verify that the resulting feed respects those positions while randomizing the remaining items.

**Acceptance Scenarios**:

1. **Given** a signed-in researcher editing an experiment, **When** they upload valid media files and provide required metadata, **Then** the new items appear in the experiment’s media list and can be previewed in the reel feed.
2. **Given** an experiment with multiple media items, **When** the researcher locks one item to the first position and one item to the last position and saves the configuration, **Then** any subsequent feed session for that experiment shows those items first and last respectively, with remaining items randomized in between.

---

### User Story 4 - Researcher shares experiment link with preserved tracking parameters (Priority: P3)

A researcher shares a public experiment link that includes tracking parameters (such as participant or recruitment source identifiers); participants open this link, experience the feed, and when they follow the end-screen button to an external destination, all original parameters are forwarded unchanged in the redirect.

**Why this priority**: Many research and survey workflows depend on consistent tracking parameters to link feed behavior with downstream survey responses or identity providers, and they assume that whatever parameters go into the feed link will also appear on the downstream destination.

**Independent Test**: Can be fully tested by generating a public experiment link with specific query parameters, opening it as a participant, reaching the end screen, clicking the continue button, and confirming that the external destination receives exactly the same query parameters and values that were present on the original link.

**Acceptance Scenarios**:

1. **Given** a public experiment link that includes arbitrary query parameters, **When** a participant opens the link and later follows the end-screen continue button, **Then** the destination URL includes all original parameters unchanged.
2. **Given** a public experiment link with a mix of known and custom query parameters, **When** a participant completes the feed and is redirected, **Then** the destination URL contains at least the same set of query parameters with the same key–value pairs, regardless of parameter order.

---

### User Story 5 - Researcher reviews and exports experiment results (Priority: P2)

A signed-in researcher opens a dashboard view for a specific experiment, filters or selects participants, reviews high-level metrics and per-participant interaction data, and exports the selected results in a downloadable format for further analysis.

**Why this priority**: Without an easy way to inspect and export results, researchers cannot turn the recorded interaction data into actionable insights or combine it with external survey responses.

**Independent Test**: Can be fully tested by running a small pilot experiment with a handful of participants, then having a researcher open the dashboard, select an experiment, preview per-participant results, and successfully download a file containing the selected data.

**Acceptance Scenarios**:

1. **Given** an experiment with at least one completed participant session, **When** a signed-in researcher opens the results dashboard and selects that experiment, **Then** they can see an overview of key metrics such as number of participants and average time spent.
2. **Given** an experiment with multiple participant sessions, **When** a researcher filters or selects a subset of participants and chooses to export, **Then** they receive a downloadable CSV or JSON file that contains per-participant data for at least the selected sessions, including basic identifiers and aggregate interaction details.

---

### User Story 6 - Researcher pre-seeds comments for media items (Priority: P3)

A signed-in researcher prepares realistic-looking comment threads for specific media items in an experiment, either by manually entering comments or by using an automated assistant that suggests comments based on the media and caption, and then attaches these comments so that they appear consistently for participants.

**Why this priority**: Pre-seeded comments help simulate real social environments and enable experiments that depend on perceived social feedback and social norms.

**Independent Test**: Can be fully tested by having a researcher configure an experiment with several media items, add pre-seeded comments manually and via the assistant for at least one item, and then preview the feed to verify that the configured comments appear in the expected order.

**Acceptance Scenarios**:

1. **Given** a signed-in researcher editing a media item, **When** they add several comments manually and save, **Then** the comments appear attached to that media item and show up for participants in the configured order.
2. **Given** a signed-in researcher editing a media item, **When** they choose to generate suggested comments from an automated assistant based on the caption and media and then accept or edit those suggestions, **Then** the final accepted comments appear for that media item when the feed is viewed.

---

### Edge Cases

- What happens when a participant opens a public experiment link for an experiment that has no media items configured? The system should show a clear message that the feed is not available and should not attempt to start a session.
- How does the system handle participants arriving after an experiment has been disabled or unpublished by the researcher via a kill switch? They should see a friendly, non-technical message that the study is no longer active.
- What happens when the configured time limit is very short (for example, only a few seconds)? The feed should still start, and the end screen should appear as soon as the limit is reached without causing errors.
- How does the system behave if a participant refreshes the feed page or re-opens the same public link during an ongoing session? The behavior should be consistent and deterministic, resuming the existing session so that the experiment timer continues from the elapsed time instead of resetting.
- What happens if media ingestion from an external URL fails (for example, unsupported URL or temporary remote error)? The researcher should receive a clear error message, and no partial or broken media entry should be added to the experiment.
 - How does the system behave if a pinned comment contains an unreachable or invalid link? The feed should still load, and clicking the link should fail gracefully without breaking the session.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow researchers to create, access, and end authenticated sessions so that only authorized users can configure projects, experiments, and media.
- **FR-002**: The system MUST allow authenticated researchers to create, view, update, and archive projects that act as containers for related experiments.
- **FR-003**: The system MUST allow authenticated researchers to create, view, update, and archive experiments under a project, where each experiment has a unique public link that does not expose the researcher’s identity.
- **FR-004**: The system MUST allow authenticated researchers to upload media files as candidate reel items, provide required metadata (such as caption and perceived engagement counts), and associate each item with a named social persona.
- **FR-005**: The system MUST allow authenticated researchers to create media items from supported external post URLs by automatically retrieving the underlying media and author information, or clearly indicate when a URL cannot be ingested.
- **FR-006**: The system MUST allow authenticated researchers to configure experiment-level feed behavior, including total time limit for the session, end-screen message, and external redirect destination.
- **FR-007**: The system MUST allow authenticated researchers to lock specific media items to a given position of the feed by placing them at that position in the feed overview while randomizing the order of all remaining items for each participant session.
 - **FR-007a**: The system MUST allow authenticated researchers to change the relative order of unlocked media items for an experiment by moving them to new positions in a feed overview, and have this saved ordering respected whenever the feed is previewed or delivered to participants (subject to any lock constraints).
- **FR-008**: The system MUST allow participants to open a public experiment link without creating an account and experience a vertically oriented, full-screen reel feed with autoplaying media, captions, and basic interaction controls (such as moving to the next item).
- **FR-009**: The system MUST enforce the configured experiment time limit so that, once reached, the feed stops and an end screen is shown with the configured message and a clear call-to-action that links to the external destination.
- **FR-010**: The system MUST ensure that, when a participant follows the end-screen action to the external destination, all query parameters that were present on the public experiment link are preserved with the same keys and values in the destination URL.
- **FR-011**: The system MUST record participant-level interaction data for each experiment session, including at minimum: (a) time spent on each media item, (b) basic navigation events (swipe or tap next, swipe or tap previous, scroll up or down), (c) engagement interactions (like, unlike, reshare, follow, unfollow), and (d) total time spent in the feed. Each interaction event MUST include event type, timestamp, and associated media item identifier; engagement events MUST include the action taken and timestamp.
- **FR-012**: The system MUST prevent unauthenticated users from accessing any researcher configuration views or modifying projects, experiments, media, or settings, while still allowing public experiment viewing where intended.
 - **FR-013**: The system MUST provide a per-experiment kill switch that allows researchers to deactivate an experiment so that its public link no longer serves the feed, does not start new sessions, and instead shows a clear, non-technical message that the study is not active.
 - **FR-014**: The system MUST, for a participant who refreshes the feed page or re-opens the same public experiment link before the time limit has been reached, resume the existing session and continue the experiment timer from the previously elapsed time rather than starting a new session or resetting the timer. Session identity MUST be keyed by the participant identifier value found in the query parameter whose name is configured by the project’s “Query String Key” setting.
 - **FR-015**: The system MUST provide a results dashboard that allows authenticated researchers to select an experiment, review high-level metrics, and download per-participant results for at least the selected sessions either as a CSV file with one row per participant-session (including key aggregates) or as a JSON file containing full per-participant, per-interaction details.
 - **FR-016**: The system MUST allow authenticated researchers to attach a single pinned comment to each media item, ensure that the pinned comment is visually distinguished and appears consistently for participants, and treat clicks on any link in that pinned comment as interaction events that are recorded.
 - **FR-017**: The system MUST allow authenticated researchers to configure multiple pre-seeded comments for each media item, define their order, and have these comments appear consistently for participants when viewing that media item.
 - **FR-018**: The system MUST provide an option for researchers to use an automated comment-generation assistant that suggests comments for a media item based on its content and caption, allow researchers to review and edit suggestions before saving, and only show comments that have been explicitly accepted.

### Key Entities *(include if feature involves data)*

- **Researcher**: Represents an authenticated user who designs and manages experiments. Key attributes include identity details, contact information, and ownership of projects and experiments.
- **Project**: Represents a logical grouping of related experiments owned by a single researcher or research group. Key attributes include a name, description, and collection of experiments.
- **Experiment (Feed)**: Represents a single participant-facing reel experience with its own configuration. Key attributes include a human-readable name, a unique public link token, feed behavior settings (time limit, end-screen message, redirect destination), an active/inactive state controlled by a kill switch, and an ordered set of media items.
- **Media Item (Reel)**: Represents a single piece of short-form content shown in the feed. Key attributes include a reference to stored media, caption text, associated social persona, perceived engagement metrics, lock position flags, its position within the experiment’s order, and any associated pinned and pre-seeded comments.
- **Social Persona**: Represents a profile used to present media as if it came from a real account. Key attributes include a display name, handle, avatar image reference, and optional link to external profile locations.
- **Participant Session**: Represents a single participant’s interaction with a specific experiment, which may span multiple page loads. Key attributes include a unique identifier, associated experiment, timestamps for session start and end, and summary measurements such as total viewed time.
- **Interaction Event**: Represents a granular action taken by a participant during an experiment session. Key attributes include the associated participant session, the media item involved, event type (for example, view start, view complete, next, previous, like, share, follow/unfollow, pinned-comment-link-click), timestamp, and any relevant event data.
 - **Pre-seeded Comment**: Represents a comment configured in advance for a specific media item. Key attributes include the associated media item, text content, an optional link, a flag indicating whether it is pinned, and its order relative to other comments on that media item.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new researcher with no prior exposure to the system can create a project, set up a single experiment with at least one media item, and successfully preview the reel feed end-to-end in under 10 minutes without external assistance.
- **SC-002**: At least 90% of participants who open a valid experiment link reach the end screen and are presented with the configured call-to-action within the intended time limit, assuming a stable network connection.
- **SC-003**: In at least 95% of recorded sessions, participant interaction and timing data are complete enough to reconstruct which media items were seen and the approximate time spent in the feed.
- **SC-004**: For experiments that include tracking query parameters in their public links, at least 99% of redirects to external destinations include all original query parameters with identical keys and values.
- **SC-005**: No unauthorized user can view or modify researcher configuration pages, projects, experiments, or media, as verified by attempting common direct-link access patterns without an authenticated researcher session.
- **SC-006**: In usability tests, at least 80% of participants report that the feed experience feels similar to common short-form video apps in terms of layout and basic interaction (such as vertical orientation and navigation between items).
