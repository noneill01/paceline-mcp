# Experimental provider adapters

PaceLine Local v0.1.0 supports FIT and TCX import as its supported, privacy-first workflow.

The repository also retains local Garmin and TrainingPeaks adapters from the original personal pilot. They require separately installed local connector projects and are not a supported distribution path, public integration, or substitute for approved provider APIs.

If an advanced user has compatible local connector projects, they can configure `PACELINE_GARMIN_MCP_PATH` and `PACELINE_TRAININGPEAKS_MCP_PATH` in `~/.paceline/.env`. Never place browser cookies or account passwords in that file.

The experimental adapter tools are read-only. They must not be relied on for commercial, multi-user, or production use.

They include provider-specific snapshots, readiness/load interpretation, risk identification, and draft planning. These are intentionally excluded from the supported local-file workflow described in the main README.
