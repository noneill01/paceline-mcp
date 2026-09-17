# Training Coach MCP — prototype

A deliberately small, read-only MCP server for exploring an adaptive endurance-training coach. It ships with fixture data and also includes a local TrainingPeaks pilot adapter.

## What it proves

- A provider-neutral training model can support useful coaching tools.
- Recovery signals drive conservative plan changes.
- Plan creation is a **draft** action; publishing to a calendar is intentionally outside this first version.

## Run locally

```sh
npm install
npm start
```

After completing the local TrainingPeaks authentication, start the live pilot with:

```sh
npm run start:trainingpeaks
```

The pilot calls only a fixed allow-list of TrainingPeaks read tools. It cannot publish, change, or delete calendar data.

Use any MCP client that supports local stdio servers. The server command is `node` and the argument is the absolute path to `src/server.js`.

## Tools

| Tool | Purpose |
| --- | --- |
| `get_athlete_training_snapshot` | Athlete profile, recent workouts, recovery signals |
| `get_todays_workout` | Every available field for today's planned and completed TrainingPeaks workouts |
| `explain_training_load` | Load trend and coaching implication |
| `assess_readiness` | Green/amber/red readiness explanation |
| `identify_training_risks` | Conservative load and recovery flags |
| `draft_next_week_plan` | Non-publishing adaptive weekly plan |

## Production path

1. Replace `src/data.js` with provider adapters that map Garmin, TrainingPeaks, and FIT/TCX uploads into a common schema.
2. Use approved provider APIs for commercial users. Community MCP servers are useful only for research and must not become the product's data-access dependency.
3. Encrypt tokens and health data, capture explicit consent, define retention/deletion controls, and complete a GDPR/privacy review.
4. Keep `draft` and `publish` separate. A publish tool should require explicit athlete confirmation and produce an audit record.
