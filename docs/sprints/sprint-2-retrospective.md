# Sprint 2 – Retrospective

**Date:** 2025-11-12  
**Attendees:**  
- Joo Chung (PO)  
- Isiah Udofia (Frontend)  
- Brian Di Bassinga (Backend/Infra)  
- Austin Smith (Scrum Master)

---

## What Went Well (at least 3)

1. **End-to-end pipeline actually works**  
   - We hit the main goal: audio → transcription → LLM → DB → dashboard, all running on a real staging environment.

2. **Architecture refactor didn’t blow us up**  
   - Moving to a clearer service-based architecture (API + worker + frontend) paid off quickly.  
   - The separation made debugging and deployment less chaotic than a single monolith.

3. **Frontend UX is minimal but usable**  
   - Stripped-down UI (upload + simple workout list) matches our “no-distraction” brand and kept scope under control.  
   - General Sans + B&W theme looks surprisingly polished for a first sprint.

4. **GitHub practice improved**  
   - Most work happened in feature branches with PRs and readable commit messages.  
   - The Sprint 2 board roughly matches reality instead of being a graveyard.

---

## What Didn’t Go Well (at least 2)

1. **Transcription / LLM integration churn**  
   - We bounced between Deepgram, Whisper, and Gemini models to get acceptable results.  
   - This added a lot of unplanned time in debugging 400 errors, prompt tweaks, and latency issues.

2. **Story sizing was optimistic**  
   - 26 points looked fine on paper, but combining infra work (Kubernetes, AWS) with greenfield API + worker + DB was a lot.  
   - The transcription story in particular hid multiple unknowns.

3. **Limited automated tests**  
   - We wrote a handful of unit tests and a basic health-check test, but coverage is still shallow.  
   - Most verification happened manually via uploads and poking the DB.

---

## What To Improve (at least 2, with action items)

1. **Treat external APIs as risky stories, not side quests**  
   - *Observation:* Most of the friction was around external model APIs.  
   - **Action:**  
     - In Sprint 3, create a dedicated “Transcription reliability & observability” story with clear non-functional criteria (p95 latency, error rate).  
     - Spike / prototype early in the sprint instead of leaving tuning to the last few days.  
   - **Owner:** Brian  
   - **Due:** First week of Sprint 3

2. **Tighten Definition of Done around tests**  
   - *Observation:* Some “Done” stories have zero automated tests.  
   - **Action:**  
     - Update team DoD: every backend story must include at least one automated test (API route, worker function, or DB query).  
     - Add a small test harness for the worker (e.g., sample audio → sample JSON) to catch obvious regressions.  
   - **Owner:** Austin (DoD enforcement), Brian (worker tests), Isiah (frontend tests)  
   - **Due:** Agreed before Sprint 3 planning; first tests merged during Sprint 3.

3. **Stop over-engineering infra for class requirements**  
   - *Observation:* Helm/K8s is nice, but it ate time we could have spent on polish or user-visible features.  
   - **Action:**  
     - Keep staging on the current AWS setup but defer any infra “nice-to-haves” (autoscaling, fancy monitoring) to explicit backlog items.  
     - For this course, prefer “boring works reliably” over “clever but brittle”.  
   - **Owner:** Joo (prioritization), Brian (implementation sanity checks)  
   - **Due:** Ongoing; reviewed each planning session.

---

## Action Items Summary

1. Create and schedule **“Transcription reliability & observability”** story for Sprint 3.  
2. Update **Definition of Done** to require at least one test per backend story.  
3. Add a minimal **worker integration test harness** (audio → JSON → DB).  
4. Capture infra improvements as **explicit backlog items** instead of sneaking them into feature work.
