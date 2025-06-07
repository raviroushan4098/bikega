
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
import { addGlobalMentionsBatch, getGlobalMentionsForUser } from '@/lib/global-mentions-service'; 
import { getRedditAccessToken } from '@/lib/reddit-api-service'; 
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

      mentions.push({ 
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

      mentions.push({ 
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

interface MockTweetExample {
  author: string;
  timestamp: string; 
  text: string;
  keyword: string;
  url: string;
}

const lpuMockTweets: MockTweetExample[] = [
  {
    author: "M Ram (@MRM_Reddy)",
    timestamp: "2024-06-07T17:09:00Z",
    text: "@Ranjan_799 @malpani Even govt is not ready to help here by taking more students in IITs/NIts without diluting quality & are concerned with brand dilution. Institutes like VIT, LPU, KL are taking 5 to 10k per campus per annum with less area, but IITs with 300 to 500 acres offering max 1500 seats",
    keyword: "LPU",
    url: "https://twitter.com/MRM_Reddy/status/mockLPU1" 
  },
  {
    author: "LPU Fashion Design (@lpufashion)",
    timestamp: "2024-06-07T13:34:00Z", 
    text: "The GC Lab at Lovely Professional University (LPU) is an integral part of the School of Fashion Design, providing students with advanced resources and hands-on experience in fashion design. #LPU #Fashion #Design #GC #Labs",
    keyword: "LPU",
    url: "https://x.com/lpufashion/status/mockLPU2" 
  },
  {
    author: "Ashmit Prajapati (@AshmitPraj64742)",
    timestamp: "2024-06-07T13:31:00Z", 
    text: "@lpuuniversity 🎉🎉👍",
    keyword: "LPU",
    url: "https://twitter.com/AshmitPraj64742/status/mockLPU3"
  }
];

function fetchTwitterMentionsMock(keywords: string[]): Partial<Mention>[] {
  if (!keywords.length) return [];
  console.log(`[TwitterMentionsMock] Simulating fetch for keywords: ${keywords.join(', ')} (Updated Mock)`);
  const outputMentions: Partial<Mention>[] = [];
  let mockIdCounter = Date.now();

  keywords.forEach(kw => {
    if (kw.toLowerCase() === 'lpu') {
      lpuMockTweets.forEach((tweet) => {
        outputMentions.push({
          id: `twitter_mock_lpu_${mockIdCounter++}`,
          platform: 'Twitter/X',
          source: `Tweet by ${tweet.author}`,
          title: tweet.text.substring(0, 60) + (tweet.text.length > 60 ? '...' : ''),
          excerpt: tweet.text,
          url: tweet.url,
          timestamp: new Date(tweet.timestamp).toISOString(),
          matchedKeyword: tweet.keyword,
          sentiment: 'neutral', 
        });
      });
    } else {
      // Generic mock for other keywords
      outputMentions.push({
        id: `twitter_mock_other_${mockIdCounter++}_${kw}`,
        platform: 'Twitter/X',
        source: `Tweet by @MockUser_${kw.replace(/\s+/g, '')}`,
        title: `A relevant tweet concerning ${kw}`,
        excerpt: `This is a simulated tweet discussing various aspects of ${kw}, designed to look like real content. It mentions ${kw} multiple times to ensure matching. #MockData`,
        url: `https://twitter.com/search?q=${encodeURIComponent(kw)}&mock_id=${mockIdCounter}`,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(), // within last 3 days
        matchedKeyword: kw,
        sentiment: Math.random() > 0.6 ? 'positive' : Math.random() < 0.3 ? 'negative' : 'neutral',
      });
    }
  });
  // Cap total mock tweets to avoid overwhelming the display
  return outputMentions.slice(0, 5);
}


function fetchGoogleNewsMentionsMock(keywords: string[]): Partial<Mention>[] {
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
    const userId = input.userId; 
    console.log(`[GatherGlobalMentionsFlow] ENTERING FLOW. Input UserID: ${userId}. Timestamp: ${new Date().toISOString()}`);
    console.log("======================================================================");

    const errors: string[] = [];
    
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

    // Phase 0: Fetch existing mentions from Firestore
    console.log(`[GatherGlobalMentionsFlow] Phase 0: Fetching existing mentions for user ${userId} from Firestore.`);
    const existingMentionsList = await getGlobalMentionsForUser(userId);
    const storedMentionsMap = new Map<string, Mention>();
    existingMentionsList.forEach(m => {
        if (m.id) storedMentionsMap.set(m.id, m);
    });
    console.log(`[GatherGlobalMentionsFlow] Found ${storedMentionsMap.size} existing mentions in Firestore for user ${userId}.`);


    let allPotentialMentionsPartial: Partial<Mention>[] = [];

    // 1. Fetch from Reddit
    console.log('[GatherGlobalMentionsFlow] Starting Reddit fetch...');
    const redditAuth = await getRedditAccessToken();
    if ('token' in redditAuth) {
      const redditMentions = await fetchRedditMentions(keywords, redditAuth.token, redditAuth.userAgent);
      allPotentialMentionsPartial.push(...redditMentions);
      console.log(`[GatherGlobalMentionsFlow] Reddit fetch complete. Found ${redditMentions.length} mentions.`);
    } else {
      errors.push(`Reddit Auth Error: ${redditAuth.error}`);
      console.error(`[GatherGlobalMentionsFlow] Reddit Auth Error: ${redditAuth.error}`);
    }

    // 2. Fetch from Hacker News
    console.log('[GatherGlobalMentionsFlow] Starting Hacker News fetch...');
    const hnMentions = await fetchHackerNewsMentions(keywords);
    allPotentialMentionsPartial.push(...hnMentions);
    console.log(`[GatherGlobalMentionsFlow] Hacker News fetch complete. Found ${hnMentions.length} mentions.`);

    // 3. Fetch from Twitter/X (Mock)
    console.log('[GatherGlobalMentionsFlow] Starting Twitter/X (Mock) fetch...');
    const twitterMentions = fetchTwitterMentionsMock(keywords);
    allPotentialMentionsPartial.push(...twitterMentions);
    console.log(`[GatherGlobalMentionsFlow] Twitter/X (Mock) fetch complete. Found ${twitterMentions.length} mentions.`);

    // 4. Fetch from Google News (Mock)
    console.log('[GatherGlobalMentionsFlow] Starting Google News (Mock) fetch...');
    const googleNewsMentions = fetchGoogleNewsMentionsMock(keywords);
    allPotentialMentionsPartial.push(...googleNewsMentions);
    console.log(`[GatherGlobalMentionsFlow] Google News (Mock) fetch complete. Found ${googleNewsMentions.length} mentions.`);

    console.log(`[GatherGlobalMentionsFlow] Total potential mentions from all API sources BEFORE deduplication by ID: ${allPotentialMentionsPartial.length}`);

    const uniqueApiMentionsMap = new Map<string, Partial<Mention>>();
    allPotentialMentionsPartial.forEach(m => {
        if (m.id && typeof m.id === 'string' && m.id.trim() !== "") {
            if (!uniqueApiMentionsMap.has(m.id)) {
                uniqueApiMentionsMap.set(m.id, m);
            }
        } else {
            console.warn(`[GatherGlobalMentionsFlow] Found a mention with invalid/missing ID. Title: "${m.title?.substring(0,30)}...", Platform: ${m.platform}. Skipping.`);
        }
    });
    const uniqueApiMentionsFromSources = Array.from(uniqueApiMentionsMap.values());
    console.log(`[GatherGlobalMentionsFlow] Total unique mentions from API sources this run (after ID deduplication): ${uniqueApiMentionsFromSources.length}`);

    // Phase 1: Initial storage of all unique API mentions
    const mentionsForInitialStorage: Mention[] = [];
    for (const partialApiMention of uniqueApiMentionsFromSources) {
        if (!partialApiMention.id) continue; // Should not happen due to prior filter, but safety check

        const existingStoredMention = storedMentionsMap.get(partialApiMention.id);
        const currentSentiment = existingStoredMention?.sentiment || 'unknown'; // Use existing sentiment if available, else 'unknown'

        mentionsForInitialStorage.push({
            ...partialApiMention,
            userId: userId,
            id: partialApiMention.id,
            platform: partialApiMention.platform || 'Other',
            source: partialApiMention.source || 'Unknown',
            title: partialApiMention.title || 'No Title',
            excerpt: partialApiMention.excerpt || '',
            url: partialApiMention.url || '#',
            timestamp: partialApiMention.timestamp || new Date().toISOString(),
            matchedKeyword: partialApiMention.matchedKeyword || 'unknown',
            sentiment: currentSentiment, // Store with current/unknown sentiment initially
        } as Mention);
    }
    
    let initialStoreSuccessCount = 0;
    if (mentionsForInitialStorage.length > 0) {
        console.log(`[GatherGlobalMentionsFlow] Phase 1: Attempting INITIAL BATCH STORE of ${mentionsForInitialStorage.length} mentions for user ${userId}.`);
        const initialStoreResult = await addGlobalMentionsBatch(userId, mentionsForInitialStorage);
        initialStoreSuccessCount = initialStoreResult.successCount;
        if (initialStoreResult.errorCount > 0) {
          errors.push(...initialStoreResult.errors.map(e => `Initial Storage Error: ${e}`));
        }
        console.log(`[GatherGlobalMentionsFlow] Initial batch storage result for user ${userId}: SuccessCount=${initialStoreResult.successCount}, ErrorCount=${initialStoreResult.errorCount}.`);
    } else {
      console.log(`[GatherGlobalMentionsFlow] No new unique mentions from APIs to initially store for user ${userId}.`);
    }

    // Phase 2: Select mentions for sentiment analysis and update
    const mentionsToConsiderForSentiment = uniqueApiMentionsFromSources.map(partialApiMention => {
        const existingStoredMention = storedMentionsMap.get(partialApiMention.id!);
        const contentChanged = existingStoredMention ? 
            (partialApiMention.title !== existingStoredMention.title || partialApiMention.excerpt !== existingStoredMention.excerpt) : true;
        
        return {
            ...partialApiMention, // This is still Partial<Mention>
            needsSentimentAnalysis: !existingStoredMention || contentChanged || existingStoredMention.sentiment === 'unknown',
            currentSentiment: existingStoredMention?.sentiment || 'unknown'
        };
    });

    const mentionsNeedingSentimentAnalysis = mentionsToConsiderForSentiment.filter(m => m.needsSentimentAnalysis);
    console.log(`[GatherGlobalMentionsFlow] Phase 2: Found ${mentionsNeedingSentimentAnalysis.length} mentions initially needing sentiment analysis (new, content changed, or sentiment unknown).`);

    const mentionsToAnalyzeThisRun = mentionsNeedingSentimentAnalysis.slice(0, MAX_SENTIMENT_ANALYSES_PER_RUN);
    console.log(`[GatherGlobalMentionsFlow] Will attempt sentiment analysis for up to ${MAX_SENTIMENT_ANALYSES_PER_RUN} mentions. Number to analyze this run: ${mentionsToAnalyzeThisRun.length}.`);

    const mentionsWithUpdatedSentiment: Mention[] = [];

    if (mentionsToAnalyzeThisRun.length > 0) {
        console.log(`[GatherGlobalMentionsFlow] Analyzing sentiment for ${mentionsToAnalyzeThisRun.length} mentions.`);
        for (const partialMentionToAnalyze of mentionsToAnalyzeThisRun) { // This loop updates sentiment on the objects
            try {
                console.log(`[GatherGlobalMentionsFlow] Waiting ${SENTIMENT_ANALYSIS_DELAY_MS}ms before sentiment call for: "${partialMentionToAnalyze.id}"`);
                await delay(SENTIMENT_ANALYSIS_DELAY_MS);

                const textToAnalyze = `${partialMentionToAnalyze.title || ''} ${partialMentionToAnalyze.excerpt || ''}`;
                console.log(`[GatherGlobalMentionsFlow] Analyzing sentiment for mention ID: "${partialMentionToAnalyze.id}", Title: "${partialMentionToAnalyze.title?.substring(0,30)}...", Excerpt (first 30): "${partialMentionToAnalyze.excerpt?.substring(0,30)}..."`);
                const sentimentResult = await analyzeAdvancedSentiment({ text: textToAnalyze });
                
                let finalSentiment: Mention['sentiment'] = 'unknown';
                if (sentimentResult.error) {
                    errors.push(`Sentiment analysis error for mention "${partialMentionToAnalyze.id}": ${sentimentResult.error}`);
                    console.warn(`[GatherGlobalMentionsFlow] Sentiment analysis error for mention "${partialMentionToAnalyze.id}" (Title: ${partialMentionToAnalyze.title?.substring(0,30)}...): ${sentimentResult.error}. Defaulting to 'unknown'.`);
                    finalSentiment = 'unknown';
                } else {
                    finalSentiment = sentimentResult.sentiment;
                }
                console.log(`[GatherGlobalMentionsFlow] Sentiment for "${partialMentionToAnalyze.id}": ${finalSentiment}.`);
                
                // Add to list for final update, ensuring all fields are present
                mentionsWithUpdatedSentiment.push({
                    id: partialMentionToAnalyze.id!,
                    userId: userId,
                    platform: partialMentionToAnalyze.platform || 'Other',
                    source: partialMentionToAnalyze.source || 'Unknown',
                    title: partialMentionToAnalyze.title || 'No Title',
                    excerpt: partialMentionToAnalyze.excerpt || '',
                    url: partialMentionToAnalyze.url || '#',
                    timestamp: partialMentionToAnalyze.timestamp || new Date().toISOString(),
                    matchedKeyword: partialMentionToAnalyze.matchedKeyword || 'unknown',
                    sentiment: finalSentiment, // The newly analyzed sentiment
                } as Mention);

            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                errors.push(`Exception during sentiment analysis for mention "${partialMentionToAnalyze.id}": ${errorMsg}`);
                console.error(`[GatherGlobalMentionsFlow] CRITICAL EXCEPTION during sentiment analysis for mention "${partialMentionToAnalyze.id}" (Title: ${partialMentionToAnalyze.title?.substring(0,30)}...):`, e);
                 // Add to list for final update, ensuring all fields are present
                mentionsWithUpdatedSentiment.push({
                    id: partialMentionToAnalyze.id!,
                    userId: userId,
                    platform: partialMentionToAnalyze.platform || 'Other',
                    source: partialMentionToAnalyze.source || 'Unknown',
                    title: partialMentionToAnalyze.title || 'No Title',
                    excerpt: partialMentionToAnalyze.excerpt || '',
                    url: partialMentionToAnalyze.url || '#',
                    timestamp: partialMentionToAnalyze.timestamp || new Date().toISOString(),
                    matchedKeyword: partialMentionToAnalyze.matchedKeyword || 'unknown',
                    sentiment: 'unknown', // Default on critical error
                } as Mention);
            }
        }
        console.log(`[GatherGlobalMentionsFlow] Finished sentiment analysis loop for ${mentionsToAnalyzeThisRun.length} mentions.`);
    } else {
        console.log('[GatherGlobalMentionsFlow] No mentions selected for sentiment analysis in this run.');
    }

    // Phase 3: Final batch update for mentions that had sentiment analysis performed
    let sentimentUpdateSuccessCount = 0;
    if (mentionsWithUpdatedSentiment.length > 0) {
        const mentionIdsForUpdate = mentionsWithUpdatedSentiment.map(m => m.id).join(', ');
        console.log(`[GatherGlobalMentionsFlow] Phase 3: Attempting to UPDATE ${mentionsWithUpdatedSentiment.length} mentions with new sentiments in Firestore. IDs: ${mentionIdsForUpdate.substring(0, 200)}${mentionIdsForUpdate.length > 200 ? '...' : ''}`);
        
        const updateStoreResult = await addGlobalMentionsBatch(userId, mentionsWithUpdatedSentiment);
        sentimentUpdateSuccessCount = updateStoreResult.successCount;
        if (updateStoreResult.errorCount > 0) {
          errors.push(...updateStoreResult.errors.map(e => `Sentiment Update Storage Error: ${e}`));
        }
        console.log(`[GatherGlobalMentionsFlow] Batch sentiment update result for user ${userId}: SuccessCount=${updateStoreResult.successCount}, ErrorCount=${updateStoreResult.errorCount}.`);
    } else {
      console.log(`[GatherGlobalMentionsFlow] No mentions had their sentiment updated for final storage for user ${userId}.`);
    }
    
    console.log("======================================================================");
    console.log(`[GatherGlobalMentionsFlow] EXITING FLOW. UserID: ${user.id} (${user.name}). Timestamp: ${new Date().toISOString()}`);
    const totalItemsWrittenOrUpdated = initialStoreSuccessCount > 0 || sentimentUpdateSuccessCount > 0 
        ? Math.max(initialStoreSuccessCount, sentimentUpdateSuccessCount) // Simplistic; a more accurate count of *unique* items written/updated would be complex here
        : 0;
    console.log(`  Summary: Unique API Mentions Fetched This Run: ${uniqueApiMentionsFromSources.length}, Items Initially Stored/Updated: ${initialStoreSuccessCount}, Items with Sentiment Updated in DB: ${sentimentUpdateSuccessCount}, Total items created/updated in DB (approx): ${totalItemsWrittenOrUpdated}, Errors during flow: ${errors.length}`);
    if(errors.length > 0) console.log(`  Encountered errors: ${errors.join('; ')}`);
    console.log("======================================================================");
    return {
      totalMentionsFetched: uniqueApiMentionsFromSources.length, 
      newMentionsStored: totalItemsWrittenOrUpdated, // Reflects items created OR updated in DB (can be new items or existing ones with new sentiment)
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


    