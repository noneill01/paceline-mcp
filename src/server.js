import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { draftPlan, loadSummary, readiness, risks, snapshot } from "./coach.js";

const server = new McpServer({ name: "training-coach", version: "0.1.0" });
const respond = (payload) => ({ content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] });

server.tool("get_athlete_training_snapshot", "Return a concise, provider-neutral athlete profile, recovery data, and recent workouts.", {}, async () => respond(snapshot()));
server.tool("explain_training_load", "Summarise recent load, compare it with the prior period, and explain the coaching implication.", {}, async () => respond(loadSummary()));
server.tool("assess_readiness", "Assess today's readiness from sleep, HRV, resting heart rate, and reported fatigue. Read-only.", {}, async () => respond(readiness()));
server.tool("identify_training_risks", "Identify non-diagnostic load and recovery risks, with conservative actions.", {}, async () => respond(risks()));
server.tool("draft_next_week_plan", "Create a non-publishing draft plan aligned to availability and current readiness.", { availableDays: z.number().int().min(2).max(7).optional().describe("Training days available next week") }, async ({ availableDays }) => respond(draftPlan(availableDays)));

await server.connect(new StdioServerTransport());
