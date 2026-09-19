# Training Coach MCP — prototype

A read-only MCP service for exploring an adaptive endurance-training coach. It combines local TrainingPeaks and Garmin connectors behind a provider-neutral workout model.

## What it proves

- TrainingPeaks plans and completed work can be compared with Garmin recordings.
- Likely duplicate activities from different providers are merged into one workout.
- Garmin activity detail can include recorded route points, HR and available device metrics.
- Recovery signals are reported only when a provider supplies them.
- Plan creation is a **draft** action; publishing to a calendar is intentionally outside this first version.

## PaceLine Local MCP

PaceLine can be used as a private, local-first MCP: activity data and encrypted provider credentials stay on the athlete's computer. The package is not published yet, but the local command-line experience is ready to test from this repository.

Strava is intentionally not included: its current API policy reserves MCP access to Strava's own official MCP. Athletes who use Strava should connect that official MCP directly to their AI client rather than route Strava data through PaceLine.

```sh
npm install
npm link
paceline-mcp init
```

`init` creates `~/.paceline/.env` with a new local encryption key and a private local database. It never uploads this file or its contents.

Run a safe configuration check at any time:

```sh
paceline-mcp doctor
```

To start the MCP in Codex or another local MCP client:

```sh
paceline-mcp serve
```

Configure your MCP client with command `paceline-mcp` and argument `serve`.

### Experimental local connectors

The Garmin and TrainingPeaks connectors are retained for personal experimentation, but are not a distributable public integration method. If an advanced user has installed compatible local connector projects, they can configure their directory paths in `~/.paceline/.env` with `PACELINE_GARMIN_MCP_PATH` and `PACELINE_TRAININGPEAKS_MCP_PATH`. Do not put browser cookies or account passwords in that file.

## Development pilot

```sh
npm install
npm start
```

After completing the local TrainingPeaks authentication, start the live pilot with:

```sh
npm run start:trainingpeaks
```

The pilot calls only fixed allow-lists of read tools. It cannot publish, change, or delete calendar data.

Use any MCP client that supports local stdio servers. The server command is `node` and the argument is the absolute path to `src/server.js`.

## Tools

| Tool | Purpose |
| --- | --- |
| `get_athlete_training_snapshot` | Athlete profile, recent workouts, recovery signals |
| `get_todays_workout` | Every available field for today's planned and completed TrainingPeaks workouts |
| `get_garmin_training_snapshot` | Recent Garmin activities plus available recovery signals |
| `get_garmin_workout_detail` | Normalized Garmin metrics and recorded GPS route points for one activity |
| `list_combined_workouts` | TrainingPeaks and Garmin workouts in a shared format, with likely duplicates merged |
| `get_combined_workout_detail` | One unified workout with planned-versus-actual comparison, provider details, available HR/power/cadence data, and Garmin route points |
| `get_combined_readiness` | TrainingPeaks form plus only the Garmin recovery signals actually available |
| `sync_private_alpha_data` | Persist merged provider data to encrypted local storage; never writes to providers |
| `list_stored_workouts` | Read the encrypted local private-alpha store |
| `explain_training_load` | Load trend and coaching implication |
| `assess_readiness` | Green/amber/red readiness explanation |
| `identify_training_risks` | Conservative load and recovery flags |
| `draft_next_week_plan` | Non-publishing adaptive weekly plan |

## Production path

The repository now includes a separate public-alpha storage boundary. It scopes workouts and provider connections to one athlete, encrypts provider credentials, records consent, removes usable credentials on disconnect, and supports full account-data deletion. It is deliberately separate from the personal pilot database.

Before opening a public alpha:

1. Put this tenant API behind real authentication; do not trust an athlete ID supplied by an MCP or browser client.
2. Move it to a managed database and managed key service, with backups, monitoring, rate limits, and scheduled synchronisation.
3. Replace the local community TrainingPeaks and Garmin adapters with approved provider APIs before offering those connections to other athletes. Add FIT/TCX/GPX imports as the no-provider-account path.
4. Keep `draft` and `publish` separate. A publish tool should require explicit athlete confirmation and produce an audit record.
