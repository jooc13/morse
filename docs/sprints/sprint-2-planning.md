# Sprint 2 – Planning

**Sprint:** 2  
**Dates:** 2025-10-30 → 2025-11-12 (America/New_York)  
**Duration:** 2 weeks  

## Sprint Goal

Deliver an integrated, functioning pipeline that:

1. Accepts audio uploads from the web dashboard
2. Transcribes audio to text via a hosted speech-to-text API
3. Parses the transcription into structured workout data via an LLM
4. Persists workouts to PostgreSQL
5. Displays parsed results on a minimal dashboard in a staging environment

In other words: *a real user can upload a workout audio file to staging and see a structured workout appear in the UI.*

## Selected User Stories

1. **Upload endpoint and file validation – #3 & #4**  
   _As a lifter, I want to upload audio files so my workouts can be processed automatically._  
   - Acceptance criteria: as defined in “Audio Upload Endpoint” and “Audio Validation and Storage”.  
   - **Story points:** 5  
   - **Owner(s):** Brian (backend), Isiah (integration)

2. **Transcription service integration – #5**  
   _As a backend system, I want to transcribe audio via an external API so that voice notes convert into text automatically._  
   - Initially planned with Deepgram; allowed to swap providers (Whisper / Gemini) as long as API is abstracted.  
   - **Story points:** 8  
   - **Owner(s):** Brian

3. **LLM parsing and schema validation – #6**  
   _As a user, I want my transcribed text converted into structured workout data so that I can view exercises clearly._  
   - Uses Claude / Gemini behind a simple LLM service interface.  
   - **Story points:** 5  
   - **Owner(s):** Brian

4. **PostgreSQL schema + storage layer – #7**  
   _As a developer, I want a normalized database schema for workouts so that structured data can be stored efficiently._  
   - Includes migrations and minimal seed data.  
   - **Story points:** 5  
   - **Owner(s):** Brian

5. **Basic dashboard visualization – #9 + #10 (minimal slice)**  
   _As a user, I want to upload an audio file and see my past workouts in a simple timeline._  
   - Includes upload UI, progress indicator, and a basic workout listing grouped by day.  
   - **Story points:** 3  
   - **Owner(s):** Isiah

**Total committed story points:** 26

## Team Capacity

- **Isiah Udofia – Frontend Dev**
  - Focus: React dashboard, upload flow, integration with API, staging deployment.
  - Estimated capacity: **12–14 points**

- **Brian Di Bassinga – Backend / Infrastructure**
  - Focus: API service, worker service, queue, DB schema, LLM/transcription integration.
  - Estimated capacity: **12–14 points**

- **Joo Chung – Product Owner**
  - Focus: clarifying requirements, backlog grooming, acceptance testing, documentation.

- **Austin Smith – Scrum Master**
  - Focus: sprint ceremonies, blocking issues, test support, keeping GitHub project updated.

**Total dev capacity:** ~24–28 points → committing **26** is aggressive but plausible.

## Dependencies & Risks

**Dependencies**

- Stable speech-to-text and LLM APIs (Deepgram / Whisper / Gemini / Claude)
- Working PostgreSQL instance accessible from API + worker
- Redis available for job queue
- AWS environment for staging deployment

**Risks**

1. **Model integration & latency**  
   - Risk: Speech-to-text or LLM API latency >10 seconds or brittle error handling.  
   - Mitigation: Start integration early, log round-trip timings, keep provider abstraction thin so we can swap models.

2. **Over-ambitious scope for a first dev sprint**  
   - Risk: Trying to ship “full” pipeline plus a polished UI.  
   - Mitigation: Keep UI intentionally minimal; prioritize end-to-end correctness over features.

3. **Kubernetes / AWS friction**  
   - Risk: Losing time wrestling with Helm/K8s instead of course requirements.  
   - Mitigation: Accept some infra debt; use Docker + a lean Helm chart; only the minimal staging path must work.

4. **LLM output variability**  
   - Risk: Unstructured or inconsistent JSON from the model breaks parsing.  
   - Mitigation: Define strict JSON schema, add validation + fallback prompt.

## Definition of Done (Sprint 2)

A story is “Done” when:

- Code is merged to `main` via PR with at least one review
- Basic tests for the story pass (API / worker unit tests or simple integration checks)
- No secrets committed (keys come from env / Helm values)
- Staging environment is updated and behaves as expected
- Relevant GitHub issue is moved to **Done** in the **Sprint 2** iteration
