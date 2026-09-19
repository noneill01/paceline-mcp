# Architecture notes

PaceLine normalises imported activity data into activities, laps, samples, metrics, and source provenance. File importers and future provider adapters feed that same model, so analysis tools do not need to depend on a specific source.

The public v0.1.0 package is local-first. It uses encrypted local activity payloads and a local stdio MCP server.

The repository includes an isolated multi-user storage prototype for future research. It is not a hosted product. A future hosted service would require authenticated identity, managed encryption keys and database, deletion/revocation controls, provider approval, rate limiting, monitoring, and explicit publishing/audit flows.
