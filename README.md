# Training Coach MCP — prototype

A read-only MCP service for exploring an adaptive endurance-training coach. It combines local TrainingPeaks and Garmin connectors behind a provider-neutral workout model, with an official Strava OAuth connector ready to configure.

## What it proves

- TrainingPeaks plans and completed work can be compared with Garmin recordings.
- Likely duplicate activities from different providers are merged into one workout.
- Garmin activity detail can include recorded route points, HR and available device metrics.
- Recovery signals are reported only when a provider supplies them.
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

The pilot calls only fixed allow-lists of read tools. It cannot publish, change, or delete calendar data.

### Strava

The Strava connector uses the official OAuth refresh-token flow. Create a Strava API application, complete its OAuth authorization, then place its client ID, client secret and refresh token in a local `.env` file using `.env.example` as the template. The MCP never returns those values. Until they are configured, `get_strava_connection_status` reports exactly what is missing.

Use any MCP client that supports local stdio servers. The server command is `node` and the argument is the absolute path to `src/server.js`.

## Tools

| Tool | Purpose |
| --- | --- |
| `get_athlete_training_snapshot` | Athlete profile, recent workouts, recovery signals |
| `get_todays_workout` | Every available field for today's planned and completed TrainingPeaks workouts |
| `get_garmin_training_snapshot` | Recent Garmin activities plus available recovery signals |
| `get_garmin_workout_detail` | Normalized Garmin metrics and recorded GPS route points for one activity |
| `list_combined_workouts` | TrainingPeaks and Garmin workouts in a shared format, with likely duplicates merged |
| `get_combined_readiness` | TrainingPeaks form plus only the Garmin recovery signals actually available |
| `get_strava_connection_status` | Safe status of the official Strava connector; no credentials exposed |
| `list_strava_workouts` | Normalized Strava activities after OAuth configuration |
| `sync_private_alpha_data` | Persist merged provider data to encrypted local storage; never writes to providers |
| `list_stored_workouts` | Read the encrypted local private-alpha store |
| `explain_training_load` | Load trend and coaching implication |
| `assess_readiness` | Green/amber/red readiness explanation |
| `identify_training_risks` | Conservative load and recovery flags |
| `draft_next_week_plan` | Non-publishing adaptive weekly plan |

## Production path

1. Replace the local community TrainingPeaks and Garmin adapters with approved provider APIs before offering the service to other athletes.
2. Add per-user OAuth credentials and consent securely, then move the encrypted local store to a managed production database with scheduled synchronisation.
3. Improve matching with provider IDs, start time and route comparison before making coaching decisions from merged workouts.
4. Keep `draft` and `publish` separate. A publish tool should require explicit athlete confirmation and produce an audit record.
