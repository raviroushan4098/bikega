
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


async function fetchRedditMentions(keywords: string[], token: string, userAgent: string): Promise<Mention[]> {
  if (!keywords.length) return [];
  const mentions: Mention[] = [];
  const queryString = keywords.map(kw => `"${kw}"`).join(' OR ');
  // Fetch recent posts (last 7 days, max 25 items)
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

      mentions.push({
        id: `reddit_${post.name}`, // e.g. reddit_t3_xxxxxx
        platform: 'Reddit',
        source: post.subreddit_name_prefixed || 'Reddit',
        title: post.title || 'No Title',
        excerpt: (post.selftext || post.title || '').substring(0, 250) + '...',
        url: `https://www.reddit.com${post.permalink}`,
        timestamp: new Date(post.created_utc * 1000).toISOString(),
        matchedKeyword: matchedKeyword,
        // Sentiment will be added later or by default in the main flow
      });
    }
  } catch (error) {
    console.error(`[RedditMentions] Exception: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log(`[RedditMentions] Fetched ${mentions.length} potential mentions matching keywords.`);
  return mentions;
}

async function fetchHackerNewsMentions(keywords: string[]): Promise<Mention[]> {
  if (!keywords.length) return [];
  const mentions: Mention[] = [];
  // OR logic for keywords. Search in title and text/comment. Tags for story or comment.
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

      mentions.push({
        id: `hackernews_${hit.objectID}`,
        platform: 'Hacker News',
        source: 'Hacker News',
        title: title,
        excerpt: (textContent).substring(0, 250) + '...',
        url: hit.url || hit.story_url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        timestamp: new Date(hit.created_at_i * 1000).toISOString(),
        matchedKeyword: matchedKeyword,
         // Sentiment will be added later or by default in the main flow
      });
    }
  } catch (error) {
    console.error(`[HackerNewsMentions] Exception: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log(`[HackerNewsMentions] Fetched ${mentions.length} potential mentions matching keywords.`);
  return mentions;
}

function fetchTwitterMentionsMock(keywords: string[]): Mention[] {
  if (!keywords.length) return [];
  console.log(`[TwitterMentionsMock] Simulating fetch for keywords: ${keywords.join(', ')} (Not Implemented)`);
  return keywords.slice(0,1).map((kw, index) => ({
    id: `twitter_mock_${Date.now() + index}`,
    platform: 'Twitter/X',
    source: 'Twitter/X Mock',
    title: `Mock Tweet about ${kw}`,
    excerpt: `This is a simulated tweet mentioning ${kw}. Real implementation would use snscrape or similar.`,
    url: `https://twitter.com/search?q=${encodeURIComponent(kw)}`,
    timestamp: new Date().toISOString(),
    matchedKeyword: kw,
    sentiment: 'neutral' // Pre-fill for mock, will be used if not analyzed
  }));
}

function fetchGoogleNewsMentionsMock(keywords: string[]): Mention[] {
  if (!keywords.length) return [];
  console.log(`[GoogleNewsMentionsMock] Simulating fetch for keywords: ${keywords.join(', ')} (Not Implemented)`);
  return keywords.slice(0,1).map((kw, index) => ({
    id: `googlenews_mock_${Date.now() + index}`,
    platform: 'Google News',
    source: 'Google News Mock',
    title: `Mock Google News article about ${kw}`,
    excerpt: `This is a simulated Google News article mentioning ${kw}. Real implementation would use a news API or scraping.`,
    url: `https://news.google.com/search?q=${encodeURIComponent(kw)}`,
    timestamp: new Date().toISOString(),
    matchedKeyword: kw,
    sentiment: 'neutral' // Pre-fill for mock
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
    console.log(`[GatherGlobalMentionsFlow] ENTERING FLOW. Input UserID: ${input.userId}. Timestamp: ${new Date().toISOString()}`);
    console.log("======================================================================");

    const errors: string[] = [];
    let totalMentionsFetchedRaw = 0;
    let initialMentionsStoredCount = 0;
    let sentimentUpdatedCount = 0;

    if (!input.userId || typeof input.userId !== 'string' || input.userId.trim() === "") {
      const invalidUserIdMsg = "Invalid or missing UserID in input.";
      errors.push(invalidUserIdMsg);
      console.error(`[GatherGlobalMentionsFlow] CRITICAL: ${invalidUserIdMsg} Received: '${input.userId}'`);
      return { totalMentionsFetched: 0, newMentionsStored: 0, errors };
    }

    const user = await getUserById(input.userId);
    if (!user || !user.id) {
      const notFoundMsg = `User with ID ${input.userId} not found or user object is invalid.`;
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

    let allPotentialMentions: Mention[] = [];

    // 1. Fetch from Reddit
    console.log('[GatherGlobalMentionsFlow] Starting Reddit fetch...');
    const redditAuth = await getRedditAccessToken();
    if ('token' in redditAuth) {
      const redditMentions = await fetchRedditMentions(keywords, redditAuth.token, redditAuth.userAgent);
      allPotentialMentions.push(...redditMentions);
      totalMentionsFetchedRaw += redditMentions.length;
      console.log(`[GatherGlobalMentionsFlow] Reddit fetch complete. Found ${redditMentions.length} mentions. Total raw now: ${totalMentionsFetchedRaw}`);
    } else {
      errors.push(`Reddit Auth Error: ${redditAuth.error}`);
      console.error(`[GatherGlobalMentionsFlow] Reddit Auth Error: ${redditAuth.error}`);
    }

    // 2. Fetch from Hacker News
    console.log('[GatherGlobalMentionsFlow] Starting Hacker News fetch...');
    const hnMentions = await fetchHackerNewsMentions(keywords);
    allPotentialMentions.push(...hnMentions);
    totalMentionsFetchedRaw += hnMentions.length;
    console.log(`[GatherGlobalMentionsFlow] Hacker News fetch complete. Found ${hnMentions.length} mentions. Total raw now: ${totalMentionsFetchedRaw}`);

    // 3. Fetch from Twitter/X (Mock)
    console.log('[GatherGlobalMentionsFlow] Starting Twitter/X (Mock) fetch...');
    const twitterMentions = fetchTwitterMentionsMock(keywords);
    allPotentialMentions.push(...twitterMentions);
    totalMentionsFetchedRaw += twitterMentions.length;
    console.log(`[GatherGlobalMentionsFlow] Twitter/X (Mock) fetch complete. Found ${twitterMentions.length} mentions. Total raw now: ${totalMentionsFetchedRaw}`);

    // 4. Fetch from Google News (Mock)
    console.log('[GatherGlobalMentionsFlow] Starting Google News (Mock) fetch...');
    const googleNewsMentions = fetchGoogleNewsMentionsMock(keywords);
    allPotentialMentions.push(...googleNewsMentions);
    totalMentionsFetchedRaw += googleNewsMentions.length;
    console.log(`[GatherGlobalMentionsFlow] Google News (Mock) fetch complete. Found ${googleNewsMentions.length} mentions. Total raw now: ${totalMentionsFetchedRaw}`);

    console.log(`[GatherGlobalMentionsFlow] Total potential mentions from all sources BEFORE deduplication by ID: ${allPotentialMentions.length}`);

    const uniquePotentialMentionsMap = new Map<string, Mention>();
    allPotentialMentions.forEach(m => {
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
    console.log(`[GatherGlobalMentionsFlow] Total unique potential mentions AFTER deduplication by ID: ${totalMentionsFetchedUnique}`);

    // Phase 1: Store all unique mentions with default 'unknown' sentiment if not already set
    if (uniquePotentialMentions.length > 0) {
      console.log(`[GatherGlobalMentionsFlow] Phase 1: Preparing initial batch store for ${uniquePotentialMentions.length} unique mentions.`);
      const mentionsForInitialStore = uniquePotentialMentions.map(m => ({
        ...m,
        sentiment: m.sentiment || 'unknown' // Ensure sentiment is set, default to 'unknown'
      }));
      
      const mentionIdsForInitialStore = mentionsForInitialStore.map(m => m.id).join(', ');
      console.log(`[GatherGlobalMentionsFlow] Attempting to initially store ${mentionsForInitialStore.length} mentions for user ${user.id} (${user.name}). IDs: ${mentionIdsForInitialStore.substring(0, 200)}${mentionIdsForInitialStore.length > 200 ? '...' : ''}`);
      
      const initialStoreResult = await addGlobalMentionsBatch(user.id, mentionsForInitialStore);
      initialMentionsStoredCount = initialStoreResult.successCount;
      if (initialStoreResult.errorCount > 0) {
        errors.push(...initialStoreResult.errors.map(e => `Initial Storage Error: ${e}`));
      }
      console.log(`[GatherGlobalMentionsFlow] Initial batch storage result for user ${user.id}: SuccessCount=${initialStoreResult.successCount}, ErrorCount=${initialStoreResult.errorCount}. Details: ${JSON.stringify(initialStoreResult)}`);
    } else {
      console.log(`[GatherGlobalMentionsFlow] No unique mentions to store initially for user ${user.id} (${user.name}).`);
    }

    // Phase 2: Perform sentiment analysis on a capped number of mentions and update them
    const mentionsToAnalyzeForSentiment = [...uniquePotentialMentions]; // Operate on a copy
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
            mention.sentiment = 'unknown'; // Keep existing or set to unknown
          } else {
             mention.sentiment = newSentiment; // Update the local object's sentiment
          }
          console.log(`[GatherGlobalMentionsFlow] Sentiment for "${mention.id}": ${mention.sentiment}.`);
          mentionsWithUpdatedSentiment.push({...mention}); // Add a copy with potentially updated sentiment

        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          errors.push(`Exception during sentiment analysis for mention "${mention.id}": ${errorMsg}`);
          console.error(`[GatherGlobalMentionsFlow] CRITICAL EXCEPTION during sentiment analysis for mention "${mention.id}" (Title: ${mention.title?.substring(0,30)}...):`, e);
          mention.sentiment = 'unknown'; // Ensure sentiment is set to unknown on error
          mentionsWithUpdatedSentiment.push({...mention}); // Still add it for update, now with 'unknown' sentiment
        }
      }
      console.log(`[GatherGlobalMentionsFlow] Finished sentiment analysis loop for ${mentionsToAnalyzeThisRun.length} mentions. Collected ${mentionsWithUpdatedSentiment.length} for update.`);

      if (mentionsWithUpdatedSentiment.length > 0) {
        const mentionIdsForUpdateStore = mentionsWithUpdatedSentiment.map(m => m.id).join(', ');
        console.log(`[GatherGlobalMentionsFlow] Attempting to update ${mentionsWithUpdatedSentiment.length} mentions with new sentiments for user ${user.id}. IDs: ${mentionIdsForUpdateStore.substring(0, 200)}${mentionIdsForUpdateStore.length > 200 ? '...' : ''}`);
        
        const updateStoreResult = await addGlobalMentionsBatch(user.id, mentionsWithUpdatedSentiment);
        sentimentUpdatedCount = updateStoreResult.successCount;
        if (updateStoreResult.errorCount > 0) {
          errors.push(...updateStoreResult.errors.map(e => `Sentiment Update Storage Error: ${e}`));
        }
        console.log(`[GatherGlobalMentionsFlow] Sentiment update batch storage result for user ${user.id}: SuccessCount=${updateStoreResult.successCount}, ErrorCount=${updateStoreResult.errorCount}. Details: ${JSON.stringify(updateStoreResult)}`);
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
      totalMentionsFetched: totalMentionsFetchedUnique, // Total unique items identified
      newMentionsStored: initialMentionsStoredCount, // Items successfully stored in the first pass
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

