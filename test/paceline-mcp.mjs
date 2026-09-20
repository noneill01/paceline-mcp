import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("../src/paceline-server.js", import.meta.url));
const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
const client = new Client({ name: "paceline-local-smoke-test", version: "0.1.1" });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ["compare_training_periods", "get_activity", "get_athlete_profile", "get_intensity_distribution", "get_local_training_summary", "get_recent_training", "get_training_load", "get_training_zones"]);
  assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint !== false), "local tools must not advertise write access");
  console.log("PaceLine local MCP smoke test passed: eight read-only local analysis tools discovered.");
} finally {
  await transport.close();
}
