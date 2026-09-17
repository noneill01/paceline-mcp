// Fixture-only data. A future provider adapter maps Garmin, TrainingPeaks, or FIT files
// into this deliberately small, provider-neutral shape.
export const athlete = {
  id: "demo-athlete",
  displayName: "Alex Runner",
  sport: "running",
  goal: "Half marathon on 2026-11-08",
  threshold: { pace: "4:35/km", heartRate: 168 },
  constraints: { availableDays: 4, maxSessionMinutes: 90, preferredLongRunDay: "Sunday" }
};

export const workouts = [
  { date: "2026-09-16", type: "easy run", durationMinutes: 42, distanceKm: 7.1, load: 43, intensity: "easy", completed: true },
  { date: "2026-09-14", type: "long run", durationMinutes: 78, distanceKm: 13.2, load: 92, intensity: "easy", completed: true },
  { date: "2026-09-12", type: "threshold intervals", durationMinutes: 55, distanceKm: 9.4, load: 83, intensity: "hard", completed: true },
  { date: "2026-09-10", type: "easy run", durationMinutes: 36, distanceKm: 6.0, load: 34, intensity: "easy", completed: true },
  { date: "2026-09-07", type: "long run", durationMinutes: 71, distanceKm: 12.0, load: 82, intensity: "easy", completed: true },
  { date: "2026-09-05", type: "hills", durationMinutes: 49, distanceKm: 8.2, load: 74, intensity: "hard", completed: true },
  { date: "2026-09-03", type: "easy run", durationMinutes: 40, distanceKm: 6.7, load: 39, intensity: "easy", completed: true }
];

export const recovery = {
  date: "2026-09-17",
  sleepHours: 6.1,
  sleepBaselineHours: 7.3,
  hrvMs: 46,
  hrvBaselineMs: 53,
  restingHeartRate: 55,
  restingHeartRateBaseline: 51,
  subjectiveFatigue: 7,
  soreness: "mild calf tightness"
};
