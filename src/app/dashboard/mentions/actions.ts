
"use server";

import { gatherGlobalMentions } from '@/ai/flows/gather-global-mentions-flow';
import type { GatherGlobalMentionsOutput } from '@/types/global-mentions-schemas';

export async function triggerGlobalMentionsRefresh(userId: string): Promise<GatherGlobalMentionsOutput> {
  if (!userId) {
    console.error("[MentionsActions] triggerGlobalMentionsRefresh called without userId.");
    return {
      totalMentionsFetched: 0,
      newMentionsStored: 0,
      errors: ["User ID is required to refresh mentions."],
    };
  }
  console.log(`[MentionsActions] Triggering global mentions refresh for user: ${userId}`);
  try {
    const result = await gatherGlobalMentions({ userId });
    console.log(`[MentionsActions] Global mentions refresh completed for user ${userId}. Result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during mentions refresh.";
    console.error(`[MentionsActions] Error during global mentions refresh for user ${userId}:`, error);
    return {
      totalMentionsFetched: 0,
      newMentionsStored: 0,
      errors: [errorMessage],
    };
  }
}
