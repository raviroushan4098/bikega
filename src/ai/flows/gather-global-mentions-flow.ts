
'use server';
/**
 * @fileOverview A Genkit flow to gather global mentions for a user from various platforms.
 *
 * - gatherGlobalMentionsFlow - Main flow function.
 * - GatherGlobalMentionsInput - Input type for the flow.
 * - GatherGlobalMentionsOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { Mention, User } from '@/types';
import { analyzeAdvancedSentiment } from '@/ai/flows/advanced-sentiment-flow';
import { addGlobalMentionsBatch } from '@/lib/global-mentions-service';
import { getRedditAccessToken } from '@/lib/reddit-api-service'; // For Reddit auth
import { getUserById } from '@/lib/user-service';
import {
  GatherGlobalMentionsInputSchema,
  type GatherGlobalMentionsInput,
  GatherGlobalMentionsOutputSchema,
  type GatherGlobalMentionsOutput
} from '@/types/global-mentions-schemas';


const API_CALL_TIMEOUT_MS = 15000; // Timeout for external API calls like Algolia
const SENTIMENT_ANALYSIS_DELAY_MS = 500; // Delay between sentiment analysis calls (0.5 seconds)
const MAX_SENTIMENT_ANALYSES_PER_RUN = 5; // Cap for sentiment analyses

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


interface RedditApiItemData {
  id: string;
  name: string; // fullname, e.g., t3_xxxx
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
  subreddit_name_prefixed?: string;
  title?: string;
  selftext?: string;
  num_comments?: number;
  link_flair_text?: string | null;
  url?: string;
  over_18?: boolean;
}

interface RedditApiChild {
  kind: 't3' | 't1' | 'more';
  data: RedditApiItemData;
}

interface RedditApiResponseData {
  after: string | null;
  dist: number;
  children: RedditApiChild[];
  before: string | null;
}

interface RedditApiResponse {
  kind: string;
  data: RedditApiResponseData;
}

interface HackerNewsHit {
  objectID: string;
  created_at_i: number; // Timestamp in seconds
  title?: string | null; // Story title or comment title
  story_title?: string | null; // Parent story title for comments
  url?: string | null; // Story URL
  story_url?: string | null; // Parent story URL for comments
  author: string;
  points?: number | null;
  story_text?: string | null; // Story self-text
  comment_text?: string | null; // Comment text
  _tags: string[]; // Contains 'story' or 'comment'
  parent_id?: number | null; // For comments
}

interface HackerNewsAlgoliaResponse {
  hits: HackerNewsHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}


// Note: userId is NOT available here. It will be added in the main flow.
async function fetchRedditMentions(keywords: string[], token: string, userAgent: string): Promise<Partial<Mention>[]> {
  if (!keywords.length) return [];
  const mentions: Partial<Mention>[] = [];
  const queryString = keywords.map(kw => `"${kw}"`).join(' OR ');
  const searchUrl = `https://oauth.reddit.com/search.json?q=${encodeURIComponent(queryString)}&limit=25&sort=new&t=week&type=t3&restrict_sr=false&include_over_18=on`;

  console.log(`[RedditMentions] Fetching from: ${searchUrl.substring(0, 150)}... for keywords: ${keywords.join(', ')}`);

  try {
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
      signal: AbortSignal.timeout(API_CALL_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[RedditMentions] API Error (${response.status}): ${errorText}`);
      return [];
    }
    const responseData: RedditApiResponse = await response.json();
    const rawPosts = (responseData.data?.children || []).filter(child => child.kind === 't3' && child.data);

    console.log(`[RedditMentions] Received ${rawPosts.length} raw posts from API.`);
    for (const child of rawPosts) {
      const post = child.data;
      const matchedKeyword = keywords.find(kw =>
        (post.title?.toLowerCase().includes(kw.toLowerCase()) || post.selftext?.toLowerCase().includes(kw.toLowerCase()))
      );
      if (!matchedKeyword) {
        console.log(`[RedditMentions] Post ID ${post.id} (Title: "${post.title?.substring(0,30)}...") did not match any keyword. Skipping.`);
        continue;
      }
      console.log(`[RedditMentions] Post ID ${post.id} matched keyword "${matchedKeyword}". Adding to list.`);

      mentions.push({ // userId will be added later in the main flow
        id: `reddit_${post.name}`,
        platform: 'Reddit',
        source: post.subreddit_name_prefixed || 'Reddit',
        title: post.title || 'No Title',
        excerpt: (post.selftext || post.title || '').substring(0, 250) + '...',
        url: `https://www.reddit.com${post.permalink}`,
        timestamp: new Date(post.created_utc * 1000).toISOString(),
        matchedKeyword: matchedKeyword,
      });
    }
  } catch (error) {
    console.error(`[RedditMentions] Exception: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log(`[RedditMentions] Fetched ${mentions.length} potential mentions matching keywords.`);
  return mentions;
}

// Note: userId is NOT available here. It will be added in the main flow.
async function fetchHackerNewsMentions(keywords: string[]): Promise<Partial<Mention>[]> {
  if (!keywords.length) return [];
  const mentions: Partial<Mention>[] = [];
  const queryKeywords = keywords.map(kw => `"${kw}"`).join(',');
  const searchUrl = `http://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(queryKeywords)}&tags=(story,comment)&hitsPerPage=25`;

  console.log(`[HackerNewsMentions] Fetching from: ${searchUrl.substring(0, 150)}... for keywords: ${keywords.join(', ')}`);

  try {
    const response = await fetch(searchUrl, { signal: AbortSignal.timeout(API_CALL_TIMEOUT_MS) });
    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[HackerNewsMentions] API Error (${response.status}): ${errorText}`);
      return [];
    }
    const responseData: HackerNewsAlgoliaResponse = await response.json();
    console.log(`[HackerNewsMentions] Received ${responseData.hits.length} raw hits from API.`);

    for (const hit of responseData.hits) {
      const textContent = hit.comment_text || hit.story_text || hit.title || "";
      const matchedKeyword = keywords.find(kw => textContent.toLowerCase().includes(kw.toLowerCase()));
      if (!matchedKeyword) {
         console.log(`[HackerNewsMentions] Hit ID ${hit.objectID} (Title: "${(hit.title || hit.story_title)?.substring(0,30)}...") did not match any keyword. Skipping.`);
        continue;
      }
      console.log(`[HackerNewsMentions] Hit ID ${hit.objectID} matched keyword "${matchedKeyword}". Adding to list.`);

      const itemType = hit._tags.includes('story') ? 'story' : hit._tags.includes('comment') ? 'comment' : 'item';
      const title = hit.title || hit.story_title || (itemType === 'comment' ? 'Comment on Hacker News' : 'Hacker News Item');

      mentions.push({ // userId will be added later
        id: `hackernews_${hit.objectID}`,
        platform: 'Hacker News',
        source: 'Hacker News',
        title: title,
        excerpt: (textContent).substring(0, 250) + '...',
        url: hit.url || hit.story_url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        timestamp: new Date(hit.created_at_i * 1000).toISOString(),
        matchedKeyword: matchedKeyword,
      });
    }
  } catch (error) {
    console.error(`[HackerNewsMentions] Exception: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log(`[HackerNewsMentions] Fetched ${mentions.length} potential mentions matching keywords.`);
  return mentions;
}

// Note: userId is NOT available here. It will be added in the main flow.
function fetchTwitterMentionsMock(keywords: string[]): Partial<Mention>[] {
  if (!keywords.length) return [];
  console.log(`[TwitterMentionsMock] Simulating fetch for keywords: ${keywords.join(', ')} (Not Implemented)`);
  return keywords.slice(0,1).map((kw, index) => ({ // userId will be added later
    id: `twitter_mock_${Date.now() + index}`,
    platform: 'Twitter/X',
    source: 'Twitter/X Mock',
    title: `Mock Tweet about ${kw}`,
    excerpt: `This is a simulated tweet mentioning ${kw}. Real implementation would use snscrape or similar.`,
    url: `https://twitter.com/search?q=${encodeURIComponent(kw)}`,
    timestamp: new Date().toISOString(),
    matchedKeyword: kw,
    sentiment: 'neutral'
  }));
}

// Note: userId is NOT available here. It will be added in the main flow.
function fetchGoogleNewsMentionsMock(keywords: string[]): Partial<Mention>[] {
  if (!keywords.length) return [];
  console.log(`[GoogleNewsMentionsMock] Simulating fetch for keywords: ${keywords.join(', ')} (Not Implemented)`);
  return keywords.slice(0,1).map((kw, index) => ({ // userId will be added later
    id: `googlenews_mock_${Date.now() + index}`,
    platform: 'Google News',
    source: 'Google News Mock',
    title: `Mock Google News article about ${kw}`,
    excerpt: `This is a simulated Google News article mentioning ${kw}. Real implementation would use a news API or scraping.`,
    url: `https://news.google.com/search?q=${encodeURIComponent(kw)}`,
    timestamp: new Date().toISOString(),
    matchedKeyword: kw,
    sentiment: 'neutral'
  }));
}


/**
 * The main Genkit flow function definition.
 */
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
    const userId = input.userId; // Use validated userId
    console.log(`[GatherGlobalMentionsFlow] ENTERING FLOW. Input UserID: ${userId}. Timestamp: ${new Date().toISOString()}`);
    console.log("======================================================================");

    const errors: string[] = [];
    let totalMentionsFetchedRaw = 0;
    let initialMentionsStoredCount = 0;
    let sentimentUpdatedCount = 0;

    const user = await getUserById(userId);
    if (!user || !user.id) {
      const notFoundMsg = `User with ID ${userId} not found or user object is invalid.`;
      errors.push(notFoundMsg);
      console.error(`[GatherGlobalMentionsFlow] ${notFoundMsg} User object from getUserById: ${JSON.stringify(user)}`);
      return { totalMentionsFetched: 0, newMentionsStored: 0, errors };
    }
    console.log(`[GatherGlobalMentionsFlow] User ${user.name} (ID: ${user.id}) successfully fetched for processing.`);

    const keywords = user.assignedKeywords;
    if (!keywords || keywords.length === 0) {
      console.log(`[GatherGlobalMentionsFlow] User ${user.name} (ID: ${user.id}) has no assigned keywords. Exiting flow.`);
      return { totalMentionsFetched: 0, newMentionsStored: 0, errors };
    }
    console.log(`[GatherGlobalMentionsFlow] Keywords for user ${user.name} (ID: ${user.id}): ${keywords.join(', ')}`);

    let allPotentialMentionsPartial: Partial<Mention>[] = [];

    // 1. Fetch from Reddit
    console.log('[GatherGlobalMentionsFlow] Starting Reddit fetch...');
    const redditAuth = await getRedditAccessToken();
    if ('token' in redditAuth) {
      const redditMentions = await fetchRedditMentions(keywords, redditAuth.token, redditAuth.userAgent);
      allPotentialMentionsPartial.push(...redditMentions);
      totalMentionsFetchedRaw += redditMentions.length;
      console.log(`[GatherGlobalMentionsFlow] Reddit fetch complete. Found ${redditMentions.length} mentions. Total raw now: ${totalMentionsFetchedRaw}`);
    } else {
      errors.push(`Reddit Auth Error: ${redditAuth.error}`);
      console.error(`[GatherGlobalMentionsFlow] Reddit Auth Error: ${redditAuth.error}`);
    }

    // 2. Fetch from Hacker News
    console.log('[GatherGlobalMentionsFlow] Starting Hacker News fetch...');
    const hnMentions = await fetchHackerNewsMentions(keywords);
    allPotentialMentionsPartial.push(...hnMentions);
    totalMentionsFetchedRaw += hnMentions.length;
    console.log(`[GatherGlobalMentionsFlow] Hacker News fetch complete. Found ${hnMentions.length} mentions. Total raw now: ${totalMentionsFetchedRaw}`);

    // 3. Fetch from Twitter/X (Mock)
    console.log('[GatherGlobalMentionsFlow] Starting Twitter/X (Mock) fetch...');
    const twitterMentions = fetchTwitterMentionsMock(keywords);
    allPotentialMentionsPartial.push(...twitterMentions);
    totalMentionsFetchedRaw += twitterMentions.length;
    console.log(`[GatherGlobalMentionsFlow] Twitter/X (Mock) fetch complete. Found ${twitterMentions.length} mentions. Total raw now: ${totalMentionsFetchedRaw}`);

    // 4. Fetch from Google News (Mock)
    console.log('[GatherGlobalMentionsFlow] Starting Google News (Mock) fetch...');
    const googleNewsMentions = fetchGoogleNewsMentionsMock(keywords);
    allPotentialMentionsPartial.push(...googleNewsMentions);
    totalMentionsFetchedRaw += googleNewsMentions.length;
    console.log(`[GatherGlobalMentionsFlow] Google News (Mock) fetch complete. Found ${googleNewsMentions.length} mentions. Total raw now: ${totalMentionsFetchedRaw}`);

    console.log(`[GatherGlobalMentionsFlow] Total potential mentions from all sources BEFORE deduplication by ID: ${allPotentialMentionsPartial.length}`);

    // Add userId to all partial mentions and prepare for unique check
    const allPotentialMentionsWithUserId: Mention[] = allPotentialMentionsPartial.map(m => ({
      ...m,
      userId: userId, // Add the userId from input
      // Ensure required fields are present, even if partial, for type conformity
      id: m.id || `generated_${Date.now()}_${Math.random()}`,
      platform: m.platform || 'Other',
      source: m.source || 'Unknown',
      title: m.title || 'No Title',
      excerpt: m.excerpt || '',
      url: m.url || '#',
      timestamp: m.timestamp || new Date().toISOString(),
      matchedKeyword: m.matchedKeyword || 'unknown',
      sentiment: m.sentiment || 'unknown', // Default sentiment to 'unknown'
    }));


    const uniquePotentialMentionsMap = new Map<string, Mention>();
    allPotentialMentionsWithUserId.forEach(m => {
      if (m.id && typeof m.id === 'string' && m.id.trim() !== "") {
        if (!uniquePotentialMentionsMap.has(m.id)) {
          uniquePotentialMentionsMap.set(m.id, m);
        } else {
          console.log(`[GatherGlobalMentionsFlow] Duplicate mention ID found and skipped: ${m.id} (Title: ${m.title?.substring(0,30)}...)`);
        }
      } else {
        console.warn(`[GatherGlobalMentionsFlow] Mention missing or invalid ID. Title: ${m.title?.substring(0,30)}...`);
      }
    });
    const uniquePotentialMentions = Array.from(uniquePotentialMentionsMap.values());
    const totalMentionsFetchedUnique = uniquePotentialMentions.length;
    console.log(`[GatherGlobalMentionsFlow] Total unique potential mentions AFTER deduplication by ID (and userId added): ${totalMentionsFetchedUnique}`);

    // Phase 1: Store all unique mentions with default 'unknown' sentiment if not already set
    if (uniquePotentialMentions.length > 0) {
      console.log(`[GatherGlobalMentionsFlow] Phase 1: Preparing initial batch store for ${uniquePotentialMentions.length} unique mentions for user ${user.id}.`);
      const mentionsForInitialStore = uniquePotentialMentions.map(m => ({
        ...m,
        sentiment: m.sentiment || 'unknown' // Ensure sentiment is 'unknown' if not already set
      }));
      
      const mentionIdsForInitialStore = mentionsForInitialStore.map(m => m.id).join(', ');
      console.log(`[GatherGlobalMentionsFlow] Attempting to initially store ${mentionsForInitialStore.length} mentions. IDs: ${mentionIdsForInitialStore.substring(0, 200)}${mentionIdsForInitialStore.length > 200 ? '...' : ''}`);
      
      // Pass userId separately for the new service signature
      const initialStoreResult = await addGlobalMentionsBatch(userId, mentionsForInitialStore);
      initialMentionsStoredCount = initialStoreResult.successCount;
      if (initialStoreResult.errorCount > 0) {
        errors.push(...initialStoreResult.errors.map(e => `Initial Storage Error: ${e}`));
      }
      console.log(`[GatherGlobalMentionsFlow] Initial batch storage result for user ${user.id}: SuccessCount=${initialStoreResult.successCount}, ErrorCount=${initialStoreResult.errorCount}. Details: ${JSON.stringify(initialStoreResult)}`);
    } else {
      console.log(`[GatherGlobalMentionsFlow] No unique mentions to store initially for user ${user.id} (${user.name}).`);
    }

    // Phase 2: Perform sentiment analysis on a capped number of mentions and update them
    const mentionsToAnalyzeForSentiment = [...uniquePotentialMentions]; 
    const mentionsWithUpdatedSentiment: Mention[] = [];

    const mentionsToAnalyzeThisRun = mentionsToAnalyzeForSentiment.slice(0, MAX_SENTIMENT_ANALYSES_PER_RUN);
    console.log(`[GatherGlobalMentionsFlow] Phase 2: Will attempt sentiment analysis for up to ${MAX_SENTIMENT_ANALYSES_PER_RUN} mentions (out of ${mentionsToAnalyzeForSentiment.length} total unique). Number to analyze this run: ${mentionsToAnalyzeThisRun.length}.`);

    if (mentionsToAnalyzeThisRun.length > 0) {
      console.log(`[GatherGlobalMentionsFlow] Analyzing sentiment for ${mentionsToAnalyzeThisRun.length} mentions.`);
      for (const mention of mentionsToAnalyzeThisRun) {
        try {
          console.log(`[GatherGlobalMentionsFlow] Waiting ${SENTIMENT_ANALYSIS_DELAY_MS}ms before sentiment call for: "${mention.id}"`);
          await delay(SENTIMENT_ANALYSIS_DELAY_MS);

          const textToAnalyze = `${mention.title || ''} ${mention.excerpt || ''}`;
          console.log(`[GatherGlobalMentionsFlow] Analyzing sentiment for mention ID: "${mention.id}", Title: "${mention.title?.substring(0,30)}...", Excerpt (first 30): "${mention.excerpt?.substring(0,30)}..."`);
          const sentimentResult = await analyzeAdvancedSentiment({ text: textToAnalyze });
          
          const newSentiment = sentimentResult.sentiment;
          if (sentimentResult.error) {
            errors.push(`Sentiment analysis error for mention "${mention.id}": ${sentimentResult.error}`);
            console.warn(`[GatherGlobalMentionsFlow] Sentiment analysis error for mention "${mention.id}" (Title: ${mention.title?.substring(0,30)}...): ${sentimentResult.error}. Defaulting to 'unknown'.`);
            mention.sentiment = 'unknown'; // Set to unknown if error
          } else {
             mention.sentiment = newSentiment; // Update the sentiment on the original mention object
          }
          console.log(`[GatherGlobalMentionsFlow] Sentiment for "${mention.id}": ${mention.sentiment}.`);
          mentionsWithUpdatedSentiment.push({...mention}); // Collect mentions that had their sentiment processed (even if errored and set to unknown)

        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          errors.push(`Exception during sentiment analysis for mention "${mention.id}": ${errorMsg}`);
          console.error(`[GatherGlobalMentionsFlow] CRITICAL EXCEPTION during sentiment analysis for mention "${mention.id}" (Title: ${mention.title?.substring(0,30)}...):`, e);
          const erroredMentionCopy = {...mention, sentiment: 'unknown' as const}; // Ensure sentiment is 'unknown'
          mentionsWithUpdatedSentiment.push(erroredMentionCopy);
        }
      }
      console.log(`[GatherGlobalMentionsFlow] Finished sentiment analysis loop for ${mentionsToAnalyzeThisRun.length} mentions. Collected ${mentionsWithUpdatedSentiment.length} for update.`);

      if (mentionsWithUpdatedSentiment.length > 0) {
        const mentionIdsForUpdateStore = mentionsWithUpdatedSentiment.map(m => m.id).join(', ');
        console.log(`[GatherGlobalMentionsFlow] Attempting to update ${mentionsWithUpdatedSentiment.length} mentions with new sentiments. IDs: ${mentionIdsForUpdateStore.substring(0, 200)}${mentionIdsForUpdateStore.length > 200 ? '...' : ''}`);
        
        // Pass userId separately for the new service signature
        const updateStoreResult = await addGlobalMentionsBatch(userId, mentionsWithUpdatedSentiment);
        sentimentUpdatedCount = updateStoreResult.successCount;
        if (updateStoreResult.errorCount > 0) {
          errors.push(...updateStoreResult.errors.map(e => `Sentiment Update Storage Error: ${e}`));
        }
        console.log(`[GatherGlobalMentionsFlow] Sentiment update batch storage result: SuccessCount=${updateStoreResult.successCount}, ErrorCount=${updateStoreResult.errorCount}. Details: ${JSON.stringify(updateStoreResult)}`);
      } else {
         console.log('[GatherGlobalMentionsFlow] No mentions had their sentiment updated, so no update batch needed.');
      }

    } else {
        console.log('[GatherGlobalMentionsFlow] No mentions selected for sentiment analysis in this run.');
    }
    
    console.log("======================================================================");
    console.log(`[GatherGlobalMentionsFlow] EXITING FLOW. UserID: ${user.id} (${user.name}). Timestamp: ${new Date().toISOString()}`);
    console.log(`  Summary: Total Unique Fetched (pre-filter/dedupe): ${totalMentionsFetchedUnique}, Items in Initial Batch Storage Attempt: ${initialMentionsStoredCount}, Items Updated with Sentiment: ${sentimentUpdatedCount}, Errors during flow: ${errors.length}`);
    if(errors.length > 0) console.log(`  Encountered errors: ${errors.join('; ')}`);
    console.log("======================================================================");
    return {
      totalMentionsFetched: totalMentionsFetchedUnique,
      newMentionsStored: initialMentionsStoredCount, // This reflects initial storage. Updates are merged.
      errors,
    };
  }
);

// Exported wrapper function to be called from client/server components
export async function gatherGlobalMentions(input: GatherGlobalMentionsInput): Promise<GatherGlobalMentionsOutput> {
  try {
    console.log(`[gatherGlobalMentions EXPORTED WRAPPER] Called for UserID ${input.userId}. Forwarding to flow runner.`);
    if (!input.userId || typeof input.userId !== 'string' || input.userId.trim() === "") {
        const errorMsg = `[gatherGlobalMentions EXPORTED WRAPPER] Invalid or missing UserID: '${input.userId}'. Aborting flow call.`;
        console.error(errorMsg);
        return { totalMentionsFetched: 0, newMentionsStored: 0, errors: [errorMsg] };
    }
    const result = await gatherGlobalMentionsFlowRunner(input);
    console.log(`[gatherGlobalMentions EXPORTED WRAPPER] Flow runner completed for UserID ${input.userId}. Result: ${JSON.stringify(result)}`);
    return result;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred in the gatherGlobalMentions flow runner.";
    console.error(`[gatherGlobalMentions EXPORTED WRAPPER] Unhandled exception from flow runner for UserID ${input.userId}: ${errorMessage}`, e);
    return {
      totalMentionsFetched: 0,
      newMentionsStored: 0,
      errors: [`Critical flow error for UserID ${input.userId}: ${errorMessage}. Check server logs.`],
    };
  }
}

