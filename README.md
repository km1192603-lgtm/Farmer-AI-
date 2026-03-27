# Farmer Assistant Platform

Custom web application (React + Node.js + AI APIs) for farmer support:

- Pest and disease diagnosis with image input
- Voice assistant in Tamil, English, Telugu, Malayalam, and Kannada
- Weather risk alerts
- Crop cultivation advice
- Market prices and prediction
- Fertilizer recommendation and calculation
- Government scheme finder
- Fresher farmer roadmap with budget planning

## Monorepo Structure

- `apps/web`: React frontend
- `apps/api`: Node/Express backend APIs
- `packages/shared`: Shared domain types
- `packages/ai-orchestrator`: AI workflow orchestration contracts
- `docs`: Planning and delivery artifacts from the implementation plan

## Run Locally

1. Install dependencies:
   - `npm install`
2. Start API:
   - `npm run dev:api`
3. Start web:
   - `npm run dev:web`
