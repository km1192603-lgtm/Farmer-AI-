# External Data and API Decisions

## Weather Provider

- Primary: OpenWeather One Call API
- Backup: WeatherAPI.com
- Refresh: every 3 hours (forecast), daily summary at 6 AM local

## Market Price Provider

- Primary: AGMARKNET (Mandi pricing feed)
- Backup: state agriculture market boards where available
- Refresh: daily ingestion + hourly cache

## Government Scheme Data

- Primary: Official central and state agriculture portals
- Ingestion model: curated JSON knowledge base + weekly sync review
- Compliance: keep source URL and last-updated date for every scheme

## AI APIs

- LLM + multimodal reasoning: configurable provider wrapper
- STT and TTS: pluggable interface per language
- Translation: unified translation adapter for 5 target languages

## Data Reliability Rules

1. If provider fails, return cached last-successful data with timestamp.
2. If both primary and backup fail, show graceful warning and allow advisory only mode.
3. Always attach source attribution for weather, market, and schemes.
