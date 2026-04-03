/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as collaboration from "../collaboration.js";
import type * as contentAi from "../contentAi.js";
import type * as contentPlans from "../contentPlans.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dm from "../dm.js";
import type * as events from "../events.js";
import type * as folders from "../folders.js";
import type * as http from "../http.js";
import type * as icsCalendar from "../icsCalendar.js";
import type * as mentions from "../mentions.js";
import type * as migrations from "../migrations.js";
import type * as notes from "../notes.js";
import type * as notifications from "../notifications.js";
import type * as projectActivity from "../projectActivity.js";
import type * as projects from "../projects.js";
import type * as seed from "../seed.js";
import type * as tags from "../tags.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";
import type * as voiceCommand from "../voiceCommand.js";
import type * as voiceCommandQueries from "../voiceCommandQueries.js";
import type * as workspaceMembers from "../workspaceMembers.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  collaboration: typeof collaboration;
  contentAi: typeof contentAi;
  contentPlans: typeof contentPlans;
  crons: typeof crons;
  dashboard: typeof dashboard;
  dm: typeof dm;
  events: typeof events;
  folders: typeof folders;
  http: typeof http;
  icsCalendar: typeof icsCalendar;
  mentions: typeof mentions;
  migrations: typeof migrations;
  notes: typeof notes;
  notifications: typeof notifications;
  projectActivity: typeof projectActivity;
  projects: typeof projects;
  seed: typeof seed;
  tags: typeof tags;
  tasks: typeof tasks;
  users: typeof users;
  voiceCommand: typeof voiceCommand;
  voiceCommandQueries: typeof voiceCommandQueries;
  workspaceMembers: typeof workspaceMembers;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
