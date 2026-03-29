import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

/** Current signed-in user profile (Convex Auth `users` table). */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});
