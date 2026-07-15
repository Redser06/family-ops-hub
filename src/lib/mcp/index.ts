import { auth, defineMcp } from "@lovable.dev/mcp-js";
import {
  getTodayOverview,
  getWeekPlan,
  listOpenTasks,
  listRecentActivity,
  getRoutines,
  getLists,
  getNotes,
  createTask,
  updateTask,
  completeTask,
  createNote,
  createList,
  addListItem,
  updateListItem,
  completeRoutineStep,
} from "./tools";

// The OAuth issuer MUST be the direct Supabase host (not the .lovable.cloud proxy).
// VITE_SUPABASE_PROJECT_ID is inlined at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "family-ops-board",
  title: "Family Ops Board",
  version: "1.0.0",
  instructions:
    "Tools for a two-adult household's shared board: today's overview, tasks, routines, lists, notes, and activity. Read tools are safe to call frequently. Write tools log to the household's activity feed. All tools act as the signed-in household member.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getTodayOverview,
    getWeekPlan,
    listOpenTasks,
    listRecentActivity,
    getRoutines,
    getLists,
    getNotes,
    createTask,
    updateTask,
    completeTask,
    createNote,
    createList,
    addListItem,
    updateListItem,
    completeRoutineStep,
  ],
});
