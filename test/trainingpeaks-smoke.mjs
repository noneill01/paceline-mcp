import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("../src/trainingpeaks-server.js", import.meta.url));
const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
const client = new Client({ name: "training-coach-live-smoke-test", version: "0.1.0" });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 6, "expected six combined coaching tools");
  const result = await client.callTool({ name: "explain_training_load", arguments: {} });
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.source, "TrainingPeaks");
  assert.equal(typeof payload.fitness.ctl, "number");
  console.log("Live TrainingPeaks MCP smoke test passed: read-only load analysis returned.");
} finally {
  await transport.close();
}
