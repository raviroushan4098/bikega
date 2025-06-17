
'use server';
/**
 * @fileOverview A Genkit flow to gather global mentions for a user,
 * focusing on assigned RSS feeds. Currently simulates parsing.
 *
 * - gatherGlobalMentionsFlow - Main flow function.
 * - GatherGlobalMentionsInput - Input type for the flow.
 * - GatherGlobalMentionsOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import type { Mention, User } from '@/types';
import { getUserById } from '@/lib/user-service';
import { addGlobalMentionsBatch, getGlobalMentionsForUser } from '@/lib/global-mentions-service';
import {
  GatherGlobalMentionsInputSchema,
  type GatherGlobalMentionsInput,
  GatherGlobalMentionsOutputSchema,
  type GatherGlobalMentionsOutput
} from '@/types/global-mentions-schemas';

const API_CALL_TIMEOUT_MS = 10000; // Timeout for fetching RSS feed

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
    let newMentionsFromRss: Mention[] = [];

    const user = await getUserById(userId);
    if (!user || !user.id) {
      const notFoundMsg = `User with ID ${userId} not found or user object is invalid.`;
      errors.push(notFoundMsg);
      return { totalMentionsFetched: 0, newMentionsStored: 0, errors };
    }
    console.log(`[GatherGlobalMentionsFlow] User ${user.name} (ID: ${user.id}) successfully fetched.`);
    
    // Keywords are useful for context, even if not directly used for RSS item filtering here yet.
    const keywords = user.assignedKeywords;
    if (!keywords || keywords.length === 0) {
      console.log(`[GatherGlobalMentionsFlow] User ${user.name} (ID: ${user.id}) has no assigned keywords (for other sources).`);
    } else {
      console.log(`[GatherGlobalMentionsFlow] Keywords for user ${user.name} (ID: ${user.id}): ${keywords.join(', ')}`);
    }

    if (user.assignedRssFeedUrls && user.assignedRssFeedUrls.length > 0) {
        console.log(`[GatherGlobalMentionsFlow] User ${userId} has ${user.assignedRssFeedUrls.length} RSS feeds assigned. URLs: ${user.assignedRssFeedUrls.join(', ')}`);
        
        // For demonstration, let's try to fetch and "parse" (simulate) the first feed.
        const firstFeedUrl = user.assignedRssFeedUrls[0];
        console.log(`[GatherGlobalMentionsFlow] Attempting to fetch XML content from: ${firstFeedUrl}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_CALL_TIMEOUT_MS);

            const response = await fetch(firstFeedUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => `Status: ${response.status}`);
                const fetchErrorMsg = `Failed to fetch RSS feed ${firstFeedUrl}. Status: ${response.status}. Response: ${errorText.substring(0,100)}`;
                console.error(`[GatherGlobalMentionsFlow] ${fetchErrorMsg}`);
                errors.push(fetchErrorMsg);
            } else {
                const xmlText = await response.text();
                console.log(`[GatherGlobalMentionsFlow] Successfully fetched XML content from ${firstFeedUrl}. Length: ${xmlText.length}. Snippet (first 300 chars): ${xmlText.substring(0, 300)}...`);
                
                // **** XML PARSING SIMULATION ****
                // In a real implementation, you would use an XML parsing library here (e.g., xml2js, fast-xml-parser)
                // to convert xmlText into a JavaScript object and extract items.
                // For now, we will create mock Mention objects to simulate this.
                console.warn(`[GatherGlobalMentionsFlow] SIMULATING XML PARSING for ${firstFeedUrl}. Actual XML parsing library needed for real data extraction.`);
                
                const feedTitleMatch = xmlText.match(/<title>(.*?)<\/title>/i);
                const feedSource = feedTitleMatch && feedTitleMatch[1] ? feedTitleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : firstFeedUrl;

                // Create 1-2 mock mentions based on the feed
                const mockMention1: Mention = {
                    id: `mock-rss-${Date.now()}-1`,
                    userId: userId,
                    platform: 'RSS Feed',
                    source: feedSource.substring(0, 50), // Use feed title as source
                    title: `Simulated: Alert from ${feedSource.substring(0,30)}...`,
                    excerpt: "This is a simulated mention from an RSS feed. Actual content would be extracted from the XML item's description.",
                    url: firstFeedUrl, // Link to the feed itself for now
                    timestamp: new Date().toISOString(),
                    sentiment: 'neutral',
                    matchedKeyword: keywords && keywords.length > 0 ? keywords[0] : "rss_feed",
                    fetchedAt: new Date().toISOString(),
                };
                newMentionsFromRss.push(mockMention1);

                if (user.assignedRssFeedUrls.length > 1) { // Add a second mock if more feeds exist
                     const mockMention2: Mention = {
                        id: `mock-rss-${Date.now()}-2`,
                        userId: userId,
                        platform: 'RSS Feed',
                        source: `Another Source from ${feedSource.substring(0,20)}...`,
                        title: `Simulated: Another item from feed`,
                        excerpt: "This is another simulated item to show multiple entries. Real parsing would yield actual items.",
                        url: user.assignedRssFeedUrls[1] || firstFeedUrl, 
                        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // An hour ago
                        sentiment: 'unknown',
                        matchedKeyword: keywords && keywords.length > 1 ? keywords[1] : (keywords && keywords.length > 0 ? keywords[0] : "rss_item"),
                        fetchedAt: new Date().toISOString(),
                    };
                    newMentionsFromRss.push(mockMention2);
                }
                errors.push(`Successfully fetched '${feedSource.substring(0,50)}...' XML. Parsed (simulated) ${newMentionsFromRss.length} item(s). Full XML parsing requires a library.`);
            }
        } catch (fetchError) {
            const castError = fetchError as Error;
            let errorMessage = castError.message || "An unknown error occurred during RSS fetch.";
            if (castError.name === 'AbortError') {
                errorMessage = `RSS feed fetch from ${firstFeedUrl} timed out after ${API_CALL_TIMEOUT_MS / 1000}s.`;
            }
            console.error(`[GatherGlobalMentionsFlow] Exception fetching RSS feed ${firstFeedUrl}: ${errorMessage}`, fetchError);
            errors.push(`Error fetching RSS feed ${firstFeedUrl}: ${errorMessage}`);
        }
    } else {
        console.log(`[GatherGlobalMentionsFlow] User ${userId} has no RSS feeds assigned.`);
        errors.push("No RSS feeds are assigned to your account. Please contact an admin to add feeds.");
    }

    let storedThisRun = 0;
    if (newMentionsFromRss.length > 0) {
      console.log(`[GatherGlobalMentionsFlow] Attempting to store ${newMentionsFromRss.length} (simulated) RSS mentions for user ${userId}.`);
      const existingMentions = await getGlobalMentionsForUser(userId);
      const existingMentionIds = new Set(existingMentions.map(m => m.id));
      
      const trulyNewMentions = newMentionsFromRss.filter(nm => !existingMentionIds.has(nm.id));

      if (trulyNewMentions.length > 0) {
        const batchResult = await addGlobalMentionsBatch(userId, trulyNewMentions);
        storedThisRun = batchResult.successCount;
        if (batchResult.errorCount > 0) {
          errors.push(...batchResult.errors);
          console.warn(`[GatherGlobalMentionsFlow] Errors storing some RSS mentions: ${batchResult.errors.join('; ')}`);
        }
         console.log(`[GatherGlobalMentionsFlow] Stored ${storedThisRun} new (simulated) RSS mentions for user ${userId}.`);
      } else {
        console.log(`[GatherGlobalMentionsFlow] All ${newMentionsFromRss.length} (simulated) RSS mentions already exist for user ${userId}. Nothing new to store.`);
        errors.push("Fetched (simulated) RSS items were already stored previously.");
      }
    }
    
    const totalFetchedThisRun = newMentionsFromRss.length; // This is simulated count

    console.log(`[GatherGlobalMentionsFlow] EXITING FLOW (RSS SIMULATION). UserID: ${user.id}. Fetched (Simulated): ${totalFetchedThisRun}, Stored: ${storedThisRun}, Messages: ${errors.length}`);
    return {
      totalMentionsFetched: totalFetchedThisRun,
      newMentionsStored: storedThisRun,
      errors,
    };
  }
);

export async function gatherGlobalMentions(input: GatherGlobalMentionsInput): Promise<GatherGlobalMentionsOutput> {
  try {
    console.log(`[gatherGlobalMentions EXPORTED WRAPPER] Called for UserID ${input.userId}. Forwarding to flow runner (RSS SIMULATION).`);
    if (!input.userId || typeof input.userId !== 'string' || input.userId.trim() === "") {
        const errorMsg = `[gatherGlobalMentions EXPORTED WRAPPER] Invalid or missing UserID: '${input.userId}'. Aborting.`;
        console.error(errorMsg);
        return { totalMentionsFetched: 0, newMentionsStored: 0, errors: [errorMsg] };
    }
    const result = await gatherGlobalMentionsFlowRunner(input);
    console.log(`[gatherGlobalMentions EXPORTED WRAPPER] Flow runner completed for UserID ${input.userId} (RSS SIMULATION).`);
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
