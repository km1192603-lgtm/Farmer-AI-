# Delivery Governance

## Sprint Plan

### Sprint 1 (Weeks 1-2)
- Finalize MVP scope and pilot assumptions
- Implement onboarding and multilingual shell
- Deliver API skeleton and health checks

### Sprint 2 (Weeks 3-4)
- Unified text assistant
- Pest diagnosis flow (image upload + response contract)
- Weather risk card integration

### Sprint 3 (Weeks 5-6)
- Fresher roadmap and budget planner
- Fertilizer planner baseline
- QA baseline and bug triage workflow

### Sprint 4 (Weeks 7-8)
- Voice assistant STT/TTS integration
- Government scheme finder v1
- Pilot UAT and readiness gate

## QA Criteria

1. Functional
   - Every core endpoint responds with valid JSON contract
   - Language toggle works across all major pages
2. Reliability
   - API P95 latency < 1.5s for advisory requests (without heavy image model)
   - Graceful fallback messages on provider failure
3. Data quality
   - Weather/market/scheme response includes source and timestamp
4. Security
   - Input validation and size limits for uploads
   - No secrets stored in frontend code

## Launch Success Metrics

- WAU/MAU engagement trend
- Pest diagnosis completion rate
- Advisory helpfulness rating (thumbs up)
- Planner completion and follow-through rate
- Reduction in time to find scheme eligibility

## Operational Cadence

- Daily standup
- Weekly risk review
- Bi-weekly demo with pilot stakeholders
- Monthly KPI review and roadmap adjustment
