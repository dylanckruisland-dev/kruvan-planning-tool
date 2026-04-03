import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync ics calendar feeds",
  { minutes: 15 },
  internal.icsCalendar.syncAllSubscriptions,
);

export default crons;
