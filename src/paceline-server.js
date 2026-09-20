import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  compareLocalTrainingPeriods,
  getLocalActivities,
  getLocalActivity,
  getLocalAthleteProfile,
  getLocalIntensityDistribution,
  getLocalTrainingLoad,
  getLocalTrainingSummary,
  getLocalTrainingZones
} from "./local-activity-service.js";

const server = new McpServer({ name: "paceline-mcp", version: "0.1.1" });
const respond = (payload) => ({ content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] });

server.tool("get_recent_training", "Return FIT/TCX-imported local activities from PaceLine's encrypted local store. Read-only.", { limit: z.number().int().min(1).max(500).optional() }, async ({ limit }) => respond(getLocalActivities(limit)));
server.tool("get_activity", "Return one local canonical activity with laps, samples, and file-provided metrics. Read-only.", { activityId: z.string().min(1) }, async ({ activityId }) => respond(getLocalActivity(activityId)));
server.tool("get_local_training_summary", "Return aggregate local duration, distance, and available training stress. Read-only.", { days: z.number().int().min(1).max(365).optional() }, async ({ days }) => respond(getLocalTrainingSummary(days)));
server.tool("get_training_load", "Calculate weekly volume and available CTL, ATL, and TSB from FIT/TCX imports. Power-derived load requires configured FTP; values are otherwise left unavailable. Read-only.", { days: z.number().int().min(7).max(365).optional() }, async ({ days }) => respond(getLocalTrainingLoad(days)));
server.tool("compare_training_periods", "Compare recent and preceding local periods by activity count, duration, distance, and available load. Read-only.", { days: z.number().int().min(7).max(180).optional() }, async ({ days }) => respond(compareLocalTrainingPeriods(days)));
server.tool("get_athlete_profile", "Return the encrypted, local-only athlete profile and the thresholds PaceLine can defensibly use. Read-only.", {}, async () => respond(getLocalAthleteProfile()));
server.tool("get_training_zones", "Return configured or profile-derived power and heart-rate zones. Values remain unavailable when no threshold is configured. Read-only.", {}, async () => respond(getLocalTrainingZones()));
server.tool("get_intensity_distribution", "Return local power and heart-rate time-in-zone distribution for a period. Power intensity is grouped as easy, moderate, and hard only when timestamped samples and zones are available. Read-only.", { days: z.number().int().min(1).max(365).optional(), sport: z.enum(["ride", "run", "swim", "strength", "other"]).optional() }, async ({ days, sport }) => respond(getLocalIntensityDistribution(days, sport)));

await server.connect(new StdioServerTransport());
