import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("../src/server.js", import.meta.url));
const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
const client = new Client({ name: "training-coach-smoke-test", version: "0.1.0" });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 5, "expected the five coaching tools");
  assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint !== false), "tools must not advertise write access");

  const result = await client.callTool({ name: "assess_readiness", arguments: {} });
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.status, "red");
  assert.match(payload.recommendation, /Do not perform intervals/);
  console.log("MCP smoke test passed: five read-only tools discovered; readiness assessment returned.");
} finally {
  await transport.close();
}
