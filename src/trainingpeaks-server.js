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
import { getCombinedReadiness, getCombinedWorkoutDetail, listCombinedWorkouts } from "./combined-coach.js";
import { getStoredWorkouts, syncPrivateAlphaData } from "./sync-service.js";
import { compareLocalTrainingPeriods, getLocalActivities, getLocalActivity, getLocalTrainingLoad, getLocalTrainingSummary } from "./local-activity-service.js";

const server = new McpServer({ name: "training-coach-combined", version: "0.3.0" });
const respond = (payload) => ({ content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] });

server.tool("get_athlete_training_snapshot", "Read a combined training snapshot from TrainingPeaks. No provider data is changed.", {}, async () => respond(await getTrainingPeaksSnapshot()));
server.tool("get_todays_workout", "Return every available TrainingPeaks field for today's planned and completed workouts. Read-only.", {}, async () => respond(await getTrainingPeaksTodaysWorkout()));
server.tool("get_garmin_training_snapshot", "Return recent Garmin activities plus available HR, HRV, resting HR, sleep, and stress signals. Read-only.", {}, async () => respond(await getGarminTrainingSnapshot()));
server.tool("get_garmin_workout_detail", "Return a normalized Garmin activity with detailed metrics and recorded GPS route points where available. Read-only.", { activityId: z.union([z.string(), z.number()]) }, async ({ activityId }) => respond(await getGarminWorkoutDetail(activityId)));
server.tool("list_combined_workouts", "Return provider-neutral workouts from TrainingPeaks and Garmin, matching likely duplicates. Read-only.", { days: z.number().int().min(1).max(90).optional() }, async ({ days }) => respond(await listCombinedWorkouts(days)));
server.tool("get_combined_workout_detail", "Return a full unified session view for one combined or provider workout ID: available planned-versus-actual fields, detailed Garmin metrics, recorded route, and source-specific TrainingPeaks data. Read-only.", { workoutId: z.string().min(1), days: z.number().int().min(1).max(90).optional() }, async ({ workoutId, days }) => respond(await getCombinedWorkoutDetail(workoutId, days)));
server.tool("get_combined_readiness", "Return TrainingPeaks form plus Garmin recovery signals that are actually available. Read-only.", {}, async () => respond(await getCombinedReadiness()));
server.tool("sync_private_alpha_data", "Synchronize provider data into encrypted local private-alpha storage. This writes only to the configured local store; it never changes provider data.", { days: z.number().int().min(1).max(90).optional() }, async ({ days }) => respond(await syncPrivateAlphaData({ days })));
server.tool("list_stored_workouts", "Read normalized workouts from encrypted local private-alpha storage. Read-only.", { limit: z.number().int().min(1).max(500).optional() }, async ({ limit }) => respond(getStoredWorkouts(limit)));
server.tool("get_recent_training", "Return FIT-imported local activities from PaceLine's encrypted local store. Read-only.", { limit: z.number().int().min(1).max(500).optional() }, async ({ limit }) => respond(getLocalActivities(limit)));
server.tool("get_activity", "Return one FIT-imported canonical activity with laps, samples, and file-provided metrics. Read-only.", { activityId: z.string().min(1) }, async ({ activityId }) => respond(getLocalActivity(activityId)));
server.tool("get_local_training_summary", "Return aggregate duration, distance, and available training stress from local FIT imports. Read-only.", { days: z.number().int().min(1).max(365).optional() }, async ({ days }) => respond(getLocalTrainingSummary(days)));
server.tool("get_training_load", "Calculate local weekly volume and available CTL, ATL, and TSB from FIT/TCX imports. Power-derived load requires configured FTP; values are otherwise left unavailable. Read-only.", { days: z.number().int().min(7).max(365).optional() }, async ({ days }) => respond(getLocalTrainingLoad(days)));
server.tool("compare_training_periods", "Compare recent and preceding local training periods by activity count, duration, distance, and available load. Read-only.", { days: z.number().int().min(7).max(180).optional() }, async ({ days }) => respond(compareLocalTrainingPeriods(days)));
server.tool("explain_training_load", "Explain TrainingPeaks fitness, fatigue, form, and recent completed load. Read-only.", {}, async () => respond(await getTrainingPeaksLoad()));
server.tool("assess_readiness", "Assess training form from TrainingPeaks load. Garmin recovery signals are not yet connected. Read-only.", {}, async () => respond(await getTrainingPeaksReadiness()));
server.tool("identify_training_risks", "Highlight conservative training-load risks from TrainingPeaks history. Read-only.", {}, async () => respond(await getTrainingPeaksRisks()));
server.tool("draft_next_week_plan", "Create a non-publishing weekly bike-training draft from recent completed TrainingPeaks load.", { availableDays: z.number().int().min(2).max(7).optional() }, async ({ availableDays }) => respond(await draftTrainingPeaksPlan(availableDays)));

await server.connect(new StdioServerTransport());
