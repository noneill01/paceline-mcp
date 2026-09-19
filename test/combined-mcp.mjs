import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("../src/trainingpeaks-server.js", import.meta.url));
const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
const client = new Client({ name: "training-coach-combined-smoke-test", version: "0.1.0" });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const detailTool = tools.find((tool) => tool.name === "get_combined_workout_detail");
  assert.ok(detailTool, "expected the unified workout-detail tool");
  assert.equal(detailTool.inputSchema.properties.workoutId.type, "string");
  assert.ok(tools.length >= 13, "expected the complete combined MCP tool surface");
  console.log("Combined MCP smoke test passed: unified workout-detail tool discovered.");
} finally {
  await transport.close();
}
