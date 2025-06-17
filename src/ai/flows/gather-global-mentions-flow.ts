
'use server';
/**
 * @fileOverview A Genkit flow to gather global mentions for a user, focusing on assigned RSS feeds.
 *
 * - gatherGlobalMentionsFlow - Main flow function.
 * - GatherGlobalMentionsInput - Input type for the flow.
 * - GatherGlobalMentionsOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import type { Mention, User } from '@/types'; // Mention type might be less used if not creating mention objects from RSS yet
// import { getApiKeys } from '@/lib/api-key-service'; // Not needed if GNews is removed for now
// import { addGlobalMentionsBatch, getGlobalMentionsForUser } from '@/lib/global-mentions-service'; // Not storing mentions from RSS yet
import { getUserById } from '@/lib/user-service';
import {
  GatherGlobalMentionsInputSchema,
  type GatherGlobalMentionsInput,
  GatherGlobalMentionsOutputSchema,
  type GatherGlobalMentionsOutput
} from '@/types/global-mentions-schemas';
// import { analyzeAdvancedSentiment } from './advanced-sentiment-flow'; // Sentiment analysis not applicable yet
// import { fetchGnewsArticles } from '@/lib/gnews-api-service'; // GNews removed for now

const API_CALL_TIMEOUT_MS = 15000; 
// const SENTIMENT_ANALYSIS_DELAY_MS = 500; // Not needed for now
// const MAX_SENTIMENT_ANALYSES_PER_RUN = 10; // Not needed for now

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Hacker News related types and functions are removed as per request to focus on RSS
// interface HackerNewsHit { ... }
// interface HackerNewsAlgoliaResponse { ... }
// async function fetchHackerNewsMentions(keywords: string[]): Promise<Partial<Mention>[]> { ... }


const gatherGlobalMentionsFlowRunner = ai.defineFlow(
  {
    name: 'gatherGlobalMentionsFlow',
    inputSchema: GatherGlobalMentionsInputSchema,
    outputSchema: GatherGlobalMentionsOutputSchema,
  },
  async (input) => {
    console.log("======================================================================");
    if (!input.userId || typeof input.userId !== 'string' || input.userId.trim() === "") {
        const invalidUserIdMsg = "[GatherGlobalMentionsFlow] CRITICAL: Invalid or missing UserID in input. Aborting flow.";
        console.error(`${invalidUserIdMsg} Received: '${input.userId}'`);
        return { totalMentionsFetched: 0, newMentionsStored: 0, errors: [invalidUserIdMsg.replace('[GatherGlobalMentionsFlow] CRITICAL: ', '')] };
    }
    const userId = input.userId;
    console.log(`[GatherGlobalMentionsFlow] ENTERING FLOW. Input UserID: ${userId}. Timestamp: ${new Date().toISOString()}`);
    const errors: string[] = [];

    const user = await getUserById(userId);
    if (!user || !user.id) {
      const notFoundMsg = `User with ID ${userId} not found or user object is invalid.`;
      errors.push(notFoundMsg);
      return { totalMentionsFetched: 0, newMentionsStored: 0, errors };
    }
    console.log(`[GatherGlobalMentionsFlow] User ${user.name} (ID: ${user.id}) successfully fetched.`);

    // Keywords are still relevant for context, even if not used for fetching HackerNews/GNews
    const keywords = user.assignedKeywords;
    if (!keywords || keywords.length === 0) {
      console.log(`[GatherGlobalMentionsFlow] User ${user.name} (ID: ${user.id}) has no assigned keywords. This is noted but RSS processing will continue if feeds are assigned.`);
    } else {
      console.log(`[GatherGlobalMentionsFlow] Keywords for user ${user.name} (ID: ${user.id}): ${keywords.join(', ')}`);
    }
    
    // Since we are not fetching/storing items from RSS yet, existing mentions logic is less relevant for this iteration.
    // const existingMentionsList = await getGlobalMentionsForUser(userId);
    // const storedMentionsMap = new Map<string, Mention>();
    // existingMentionsList.forEach(m => { if (m.id) storedMentionsMap.set(m.id, m); });
    // console.log(`[GatherGlobalMentionsFlow] Found ${storedMentionsMap.size} existing mentions in Firestore for user ${userId}.`);

    // Removed Hacker News fetching
    // const hnMentions = await fetchHackerNewsMentions(keywords);
    // allPotentialMentionsPartial.push(...hnMentions);
    // console.log(`[GatherGlobalMentionsFlow] Hacker News fetch complete. Found ${hnMentions.length} mentions.`);

    // Removed GNews API fetching
    // console.log('[GatherGlobalMentionsFlow] GNews API fetch skipped in this version.');
    // errors.push("Note: GNews fetching is temporarily disabled to focus on RSS feeds.");


    if (user.assignedRssFeedUrls && user.assignedRssFeedUrls.length > 0) {
        console.log(`[GatherGlobalMentionsFlow] User ${userId} has ${user.assignedRssFeedUrls.length} RSS feeds assigned. URLs: ${user.assignedRssFeedUrls.join(', ')}`);
        errors.push(`Found ${user.assignedRssFeedUrls.length} RSS feed(s) assigned. Full parsing and display of content from these feeds is currently under development and will be available in a future update.`);
    } else {
        console.log(`[GatherGlobalMentionsFlow] User ${userId} has no RSS feeds assigned.`);
        errors.push("No RSS feeds are assigned to your account. Please contact an admin to add feeds.");
    }

    // Since no mentions are being fetched or processed from RSS yet:
    const totalFetchedThisRun = 0;
    const storedThisRun = 0;

    console.log(`[GatherGlobalMentionsFlow] EXITING FLOW (RSS Focus). UserID: ${user.id}. Fetched: ${totalFetchedThisRun}, Stored: ${storedThisRun}, Messages: ${errors.length}`);
    return {
      totalMentionsFetched: totalFetchedThisRun,
      newMentionsStored: storedThisRun,
      errors, // This will carry the "under development" message
    };
  }
);

export async function gatherGlobalMentions(input: GatherGlobalMentionsInput): Promise<GatherGlobalMentionsOutput> {
  try {
    console.log(`[gatherGlobalMentions EXPORTED WRAPPER] Called for UserID ${input.userId}. Forwarding to flow runner (RSS Focus).`);
    if (!input.userId || typeof input.userId !== 'string' || input.userId.trim() === "") {
        const errorMsg = `[gatherGlobalMentions EXPORTED WRAPPER] Invalid or missing UserID: '${input.userId}'. Aborting.`;
        console.error(errorMsg);
        return { totalMentionsFetched: 0, newMentionsStored: 0, errors: [errorMsg] };
    }
    const result = await gatherGlobalMentionsFlowRunner(input);
    console.log(`[gatherGlobalMentions EXPORTED WRAPPER] Flow runner completed for UserID ${input.userId} (RSS Focus).`);
    return result;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error in gatherGlobalMentions flow runner.";
    console.error(`[gatherGlobalMentions EXPORTED WRAPPER] Unhandled exception for UserID ${input.userId}: ${errorMessage}`, e);
    return {
      totalMentionsFetched: 0, newMentionsStored: 0,
      errors: [`Critical flow error for UserID ${input.userId}: ${errorMessage}. Check server logs.`],
    };
  }
}
