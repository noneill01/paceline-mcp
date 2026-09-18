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
import { getGarminTrainingSnapshot, getGarminWorkoutDetail } from "./garmin-adapter.js";
import { getCombinedReadiness, listCombinedWorkouts } from "./combined-coach.js";
import { getStravaConnectionStatus, listStravaWorkouts } from "./strava-adapter.js";
import { getStoredWorkouts, syncPrivateAlphaData } from "./sync-service.js";

const server = new McpServer({ name: "training-coach-combined", version: "0.3.0" });
const respond = (payload) => ({ content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] });

server.tool("get_athlete_training_snapshot", "Read a combined training snapshot from TrainingPeaks. No provider data is changed.", {}, async () => respond(await getTrainingPeaksSnapshot()));
server.tool("get_todays_workout", "Return every available TrainingPeaks field for today's planned and completed workouts. Read-only.", {}, async () => respond(await getTrainingPeaksTodaysWorkout()));
server.tool("get_garmin_training_snapshot", "Return recent Garmin activities plus available HR, HRV, resting HR, sleep, and stress signals. Read-only.", {}, async () => respond(await getGarminTrainingSnapshot()));
server.tool("get_garmin_workout_detail", "Return a normalized Garmin activity with detailed metrics and recorded GPS route points where available. Read-only.", { activityId: z.union([z.string(), z.number()]) }, async ({ activityId }) => respond(await getGarminWorkoutDetail(activityId)));
server.tool("list_combined_workouts", "Return provider-neutral workouts from TrainingPeaks and Garmin, matching likely duplicates. Strava is included only after OAuth is configured. Read-only.", { days: z.number().int().min(1).max(90).optional(), includeStrava: z.boolean().optional() }, async ({ days, includeStrava }) => respond(await listCombinedWorkouts(days, includeStrava)));
server.tool("get_combined_readiness", "Return TrainingPeaks form plus Garmin recovery signals that are actually available. Read-only.", {}, async () => respond(await getCombinedReadiness()));
server.tool("get_strava_connection_status", "Report whether the official Strava OAuth connector is configured, without exposing credentials. Read-only.", {}, async () => respond(getStravaConnectionStatus()));
server.tool("list_strava_workouts", "Return normalized Strava workouts after the official OAuth connector is configured. Read-only.", {}, async () => respond(await listStravaWorkouts()));
server.tool("sync_private_alpha_data", "Synchronize provider data into encrypted local private-alpha storage. This writes only to the configured local store; it never changes provider data.", { days: z.number().int().min(1).max(90).optional(), includeStrava: z.boolean().optional() }, async ({ days, includeStrava }) => respond(await syncPrivateAlphaData({ days, includeStrava })));
server.tool("list_stored_workouts", "Read normalized workouts from encrypted local private-alpha storage. Read-only.", { limit: z.number().int().min(1).max(500).optional() }, async ({ limit }) => respond(getStoredWorkouts(limit)));
server.tool("explain_training_load", "Explain TrainingPeaks fitness, fatigue, form, and recent completed load. Read-only.", {}, async () => respond(await getTrainingPeaksLoad()));
server.tool("assess_readiness", "Assess training form from TrainingPeaks load. Garmin recovery signals are not yet connected. Read-only.", {}, async () => respond(await getTrainingPeaksReadiness()));
server.tool("identify_training_risks", "Highlight conservative training-load risks from TrainingPeaks history. Read-only.", {}, async () => respond(await getTrainingPeaksRisks()));
server.tool("draft_next_week_plan", "Create a non-publishing weekly bike-training draft from recent completed TrainingPeaks load.", { availableDays: z.number().int().min(2).max(7).optional() }, async ({ availableDays }) => respond(await draftTrainingPeaksPlan(availableDays)));

await server.connect(new StdioServerTransport());
