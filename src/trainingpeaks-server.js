import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  draftTrainingPeaksPlan,
  getTrainingPeaksLoad,
  getTrainingPeaksReadiness,
  getTrainingPeaksRisks,
  getTrainingPeaksSnapshot,
  getTrainingPeaksTodaysWorkout
} from "./trainingpeaks-adapter.js";
import { getGarminTrainingSnapshot } from "./garmin-adapter.js";

const server = new McpServer({ name: "training-coach-combined", version: "0.2.0" });
const respond = (payload) => ({ content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] });

server.tool("get_athlete_training_snapshot", "Read a combined training snapshot from TrainingPeaks. No provider data is changed.", {}, async () => respond(await getTrainingPeaksSnapshot()));
server.tool("get_todays_workout", "Return every available TrainingPeaks field for today's planned and completed workouts. Read-only.", {}, async () => respond(await getTrainingPeaksTodaysWorkout()));
server.tool("get_garmin_training_snapshot", "Return recent Garmin activities plus available HR, HRV, resting HR, sleep, and stress signals. Read-only.", {}, async () => respond(await getGarminTrainingSnapshot()));
server.tool("explain_training_load", "Explain TrainingPeaks fitness, fatigue, form, and recent completed load. Read-only.", {}, async () => respond(await getTrainingPeaksLoad()));
server.tool("assess_readiness", "Assess training form from TrainingPeaks load. Garmin recovery signals are not yet connected. Read-only.", {}, async () => respond(await getTrainingPeaksReadiness()));
server.tool("identify_training_risks", "Highlight conservative training-load risks from TrainingPeaks history. Read-only.", {}, async () => respond(await getTrainingPeaksRisks()));
server.tool("draft_next_week_plan", "Create a non-publishing weekly bike-training draft from recent completed TrainingPeaks load.", { availableDays: z.number().int().min(2).max(7).optional() }, async ({ availableDays }) => respond(await draftTrainingPeaksPlan(availableDays)));

await server.connect(new StdioServerTransport());
