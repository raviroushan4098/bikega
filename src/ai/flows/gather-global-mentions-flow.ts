
'use server';
/**
 * @fileOverview A Genkit flow to gather global mentions for a user from various platforms.
 *
 * - gatherGlobalMentionsFlow - Main flow function.
 * - GatherGlobalMentionsInput - Input type for the flow.
 * - GatherGlobalMentionsOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit'; // Keep z from genkit for ai.defineFlow if needed, or remove if only schemas use it
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
const SENTIMENT_ANALYSIS_DELAY_MS = 10000; // Delay between sentiment analysis calls (reverted to 10000ms)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Schemas and types are now imported from '@/types/global-mentions-schemas'

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

  console.log(`[RedditMentions] Fetching from: ${searchUrl}`);

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

    for (const child of rawPosts) {
      const post = child.data;
      const matchedKeyword = keywords.find(kw =>
        (post.title?.toLowerCase().includes(kw.toLowerCase()) || post.selftext?.toLowerCase().includes(kw.toLowerCase()))
      );
      if (!matchedKeyword) continue;

      mentions.push({
        id: `reddit_${post.name}`, // e.g. reddit_t3_xxxxxx
        platform: 'Reddit',
        source: post.subreddit_name_prefixed || 'Reddit',
        title: post.title || 'No Title',
        excerpt: (post.selftext || post.title || '').substring(0, 250) + '...',
        url: `https://www.reddit.com${post.permalink}`,
        timestamp: new Date(post.created_utc * 1000).toISOString(),
        matchedKeyword: matchedKeyword,
        // Sentiment will be added later
      });
    }
  } catch (error) {
    console.error(`[RedditMentions] Exception: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log(`[RedditMentions] Fetched ${mentions.length} potential mentions.`);
  return mentions;
}

async function fetchHackerNewsMentions(keywords: string[]): Promise<Mention[]> {
  if (!keywords.length) return [];
  const mentions: Mention[] = [];
  // OR logic for keywords. Search in title and text/comment. Tags for story or comment.
  const queryKeywords = keywords.map(kw => `"${kw}"`).join(',');
  const searchUrl = `http://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(queryKeywords)}&tags=(story,comment)&hitsPerPage=25`;
  
  console.log(`[HackerNewsMentions] Fetching from: ${searchUrl}`);

  try {
    const response = await fetch(searchUrl, { signal: AbortSignal.timeout(API_CALL_TIMEOUT_MS) });
    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[HackerNewsMentions] API Error (${response.status}): ${errorText}`);
      return [];
    }
    const responseData: HackerNewsAlgoliaResponse = await response.json();

    for (const hit of responseData.hits) {
      const textContent = hit.comment_text || hit.story_text || hit.title || "";
      const matchedKeyword = keywords.find(kw => textContent.toLowerCase().includes(kw.toLowerCase()));
      if (!matchedKeyword) continue;

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
        // Sentiment will be added later
      });
    }
  } catch (error) {
    console.error(`[HackerNewsMentions] Exception: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log(`[HackerNewsMentions] Fetched ${mentions.length} potential mentions.`);
  return mentions;
}

function fetchTwitterMentionsMock(keywords: string[]): Mention[] {
  if (!keywords.length) return [];
  console.log(`[TwitterMentionsMock] Simulating fetch for keywords: ${keywords.join(', ')} (Not Implemented)`);
  // Return 1-2 mock mentions if keywords are present
  return keywords.slice(0,1).map((kw, index) => ({
    id: `twitter_mock_${Date.now() + index}`,
    platform: 'Twitter/X',
    source: 'Twitter/X Mock',
    title: `Mock Tweet about ${kw}`,
    excerpt: `This is a simulated tweet mentioning ${kw}. Real implementation would use snscrape or similar.`,
    url: `https://twitter.com/search?q=${encodeURIComponent(kw)}`,
    timestamp: new Date().toISOString(),
    matchedKeyword: kw,
    sentiment: 'neutral' // Pre-fill for mock
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
    console.log('[GatherGlobalMentionsFlow] Starting flow for user:', input.userId);
    const errors: string[] = [];
    let totalMentionsFetched = 0;
    let newMentionsStoredCount = 0;

    const user = await getUserById(input.userId);
    if (!user) {
      errors.push(`User with ID ${input.userId} not found.`);
      return { totalMentionsFetched, newMentionsStored: newMentionsStoredCount, errors };
    }

    const keywords = user.assignedKeywords;
    if (!keywords || keywords.length === 0) {
      console.log('[GatherGlobalMentionsFlow] User has no assigned keywords.');
      return { totalMentionsFetched, newMentionsStored: newMentionsStoredCount, errors };
    }
    console.log(`[GatherGlobalMentionsFlow] Keywords for user ${input.userId}: ${keywords.join(', ')}`);

    let allPotentialMentions: Mention[] = [];

    // 1. Fetch from Reddit
    const redditAuth = await getRedditAccessToken();
    if ('token' in redditAuth) {
      const redditMentions = await fetchRedditMentions(keywords, redditAuth.token, redditAuth.userAgent);
      allPotentialMentions.push(...redditMentions);
      totalMentionsFetched += redditMentions.length;
    } else {
      errors.push(`Reddit Auth Error: ${redditAuth.error}`);
      console.error(`[GatherGlobalMentionsFlow] Reddit Auth Error: ${redditAuth.error}`);
    }

    // 2. Fetch from Hacker News
    const hnMentions = await fetchHackerNewsMentions(keywords);
    allPotentialMentions.push(...hnMentions);
    totalMentionsFetched += hnMentions.length;
    
    // 3. Fetch from Twitter/X (Mock)
    const twitterMentions = fetchTwitterMentionsMock(keywords);
    allPotentialMentions.push(...twitterMentions);
    totalMentionsFetched += twitterMentions.length;

    // 4. Fetch from Google News (Mock)
    const googleNewsMentions = fetchGoogleNewsMentionsMock(keywords);
    allPotentialMentions.push(...googleNewsMentions);
    totalMentionsFetched += googleNewsMentions.length;

    console.log(`[GatherGlobalMentionsFlow] Total potential mentions from all sources: ${allPotentialMentions.length}`);

    const mentionsToProcessForSentiment = allPotentialMentions.filter(m => !m.sentiment); // Process only those without pre-filled sentiment
    const processedMentions: Mention[] = allPotentialMentions.filter(m => !!m.sentiment); // Keep pre-filled ones

    if (mentionsToProcessForSentiment.length > 0) {
      console.log(`[GatherGlobalMentionsFlow] Analyzing sentiment for ${mentionsToProcessForSentiment.length} mentions.`);
      for (const mention of mentionsToProcessForSentiment) {
        try {
          // Small delay before each sentiment analysis call to respect rate limits if any on Gemini key
          await delay(SENTIMENT_ANALYSIS_DELAY_MS); 
          
          const textToAnalyze = `${mention.title} ${mention.excerpt}`;
          console.log(`[GatherGlobalMentionsFlow] Analyzing sentiment for: "${textToAnalyze.substring(0,50)}..."`);
          const sentimentResult = await analyzeAdvancedSentiment({ text: textToAnalyze });
          mention.sentiment = sentimentResult.sentiment;
          if (sentimentResult.error) {
            errors.push(`Sentiment analysis error for mention "${mention.title.substring(0,20)}...": ${sentimentResult.error}`);
            console.warn(`[GatherGlobalMentionsFlow] Sentiment analysis error for mention "${mention.id}": ${sentimentResult.error}`);
            mention.sentiment = 'unknown'; // Default on error
          }
          console.log(`[GatherGlobalMentionsFlow] Sentiment for "${mention.id}": ${mention.sentiment}`);
          processedMentions.push(mention);
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          errors.push(`Exception during sentiment analysis for mention "${mention.title.substring(0,20)}...": ${errorMsg}`);
          console.error(`[GatherGlobalMentionsFlow] Exception during sentiment analysis for mention "${mention.id}":`, e);
          mention.sentiment = 'unknown';
          processedMentions.push(mention); // Still add it, but with unknown sentiment
        }
      }
    } else {
        console.log('[GatherGlobalMentionsFlow] No new mentions to analyze for sentiment (all were mocks with pre-filled sentiment).');
    }
    
    if (processedMentions.length > 0) {
      // Deduplicate mentions by ID before storing
      const uniqueMentionsMap = new Map<string, Mention>();
      processedMentions.forEach(m => uniqueMentionsMap.set(m.id, m));
      const uniqueMentionsToStore = Array.from(uniqueMentionsMap.values());

      console.log(`[GatherGlobalMentionsFlow] Storing ${uniqueMentionsToStore.length} unique processed mentions for user ${input.userId}.`);
      const storeResult = await addGlobalMentionsBatch(input.userId, uniqueMentionsToStore);
      newMentionsStoredCount = storeResult.successCount;
      if (storeResult.errorCount > 0) {
        errors.push(...storeResult.errors.map(e => `Storage Error: ${e}`));
        console.error(`[GatherGlobalMentionsFlow] Errors during batch storage: ${storeResult.errors.join(', ')}`);
      }
    } else {
      console.log('[GatherGlobalMentionsFlow] No mentions to store.');
    }

    console.log(`[GatherGlobalMentionsFlow] Flow finished for user ${input.userId}. New mentions stored: ${newMentionsStoredCount}. Total fetched (pre-filter): ${totalMentionsFetched}. Errors: ${errors.length}`);
    return {
      totalMentionsFetched,
      newMentionsStored: newMentionsStoredCount,
      errors,
    };
  }
);

// Exported wrapper function to be called from client/server components
export async function gatherGlobalMentions(input: GatherGlobalMentionsInput): Promise<GatherGlobalMentionsOutput> {
  try {
    return await gatherGlobalMentionsFlowRunner(input);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred in the gatherGlobalMentions flow runner.";
    console.error(`[gatherGlobalMentions EXPORTED WRAPPER] Unhandled exception from flow runner: ${errorMessage}`, e);
    return {
      totalMentionsFetched: 0,
      newMentionsStored: 0,
      errors: [`Critical flow error: ${errorMessage}`],
    };
  }
}

