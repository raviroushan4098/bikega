
'use server';
/**
 * @fileOverview A Genkit flow to gather global mentions for a user from various platforms.
 *
 * - gatherGlobalMentionsFlow - Main flow function.
 * - GatherGlobalMentionsInput - Input type for the flow.
 * - GatherGlobalMentionsOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import type { Mention, User, ApiKey } from '@/types';
import { getApiKeys } from '@/lib/api-key-service'; 
import { addGlobalMentionsBatch, getGlobalMentionsForUser } from '@/lib/global-mentions-service';
import { getUserById } from '@/lib/user-service';
import {
  GatherGlobalMentionsInputSchema,
  type GatherGlobalMentionsInput,
  GatherGlobalMentionsOutputSchema,
  type GatherGlobalMentionsOutput
} from '@/types/global-mentions-schemas';
import { analyzeAdvancedSentiment } from './advanced-sentiment-flow';
import { fetchGnewsArticles } from '@/lib/gnews-api-service';

const API_CALL_TIMEOUT_MS = 15000; 
const SENTIMENT_ANALYSIS_DELAY_MS = 500;
const MAX_SENTIMENT_ANALYSES_PER_RUN = 10; // Increased slightly

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface HackerNewsHit {
  objectID: string;
  created_at_i: number; 
  title?: string | null; 
  story_title?: string | null; 
  url?: string | null; 
  story_url?: string | null; 
  author: string;
  points?: number | null;
  story_text?: string | null; 
  comment_text?: string | null; 
  _tags: string[]; 
  parent_id?: number | null; 
}

interface HackerNewsAlgoliaResponse {
  hits: HackerNewsHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}

// Helper function to generate a unique ID for GNews articles (using URL if available)
const generateGnewsMentionId = (article: any, userId: string): string => {
    if (article.url && typeof article.url === 'string' && article.url.trim() !== '') {
        // Simple hash for URL to keep ID somewhat manageable in length and consistent
        let hash = 0;
        for (let i = 0; i < article.url.length; i++) {
            const char = article.url.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return `gnews_${userId}_${Math.abs(hash)}`;
    }
    // Fallback ID if URL is missing or invalid
    const fallbackBase = article.title || article.description || `no_content_${Math.random().toString(36).substring(2, 8)}`;
    let hash = 0;
    for (let i = 0; i < fallbackBase.length; i++) {
        const char = fallbackBase.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return `gnews_fallback_${userId}_${Math.abs(hash)}_${Date.now()}`;
};


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
        continue;
      }
      
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

const lpuMockNewsItems = [ /* ... existing mock items ... */ ]; // Keep existing mock for fetchGoogleNewsMentionsMock if needed as fallback

function fetchGoogleNewsMentionsMock(keywords: string[]): Partial<Mention>[] {
  if (!keywords.length) return [];
  // ... (implementation as before) ...
  return []; // Returning empty for now as we prioritize real GNews
}

function fetchWebMentionsMock(keywords: string[]): Partial<Mention>[] {
  if (!keywords.length) return [];
  // ... (implementation as before) ...
  return []; // Returning empty for now
}

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

    const keywords = user.assignedKeywords;
    if (!keywords || keywords.length === 0) {
      console.log(`[GatherGlobalMentionsFlow] User ${user.name} (ID: ${user.id}) has no assigned keywords. Exiting flow.`);
      return { totalMentionsFetched: 0, newMentionsStored: 0, errors };
    }
    console.log(`[GatherGlobalMentionsFlow] Keywords for user ${user.name} (ID: ${user.id}): ${keywords.join(', ')}`);

    const existingMentionsList = await getGlobalMentionsForUser(userId);
    const storedMentionsMap = new Map<string, Mention>();
    existingMentionsList.forEach(m => { if (m.id) storedMentionsMap.set(m.id, m); });
    console.log(`[GatherGlobalMentionsFlow] Found ${storedMentionsMap.size} existing mentions in Firestore for user ${userId}.`);

    let allPotentialMentionsPartial: Partial<Mention>[] = [];

    const hnMentions = await fetchHackerNewsMentions(keywords);
    allPotentialMentionsPartial.push(...hnMentions);
    console.log(`[GatherGlobalMentionsFlow] Hacker News fetch complete. Found ${hnMentions.length} mentions.`);

    console.log('[GatherGlobalMentionsFlow] Starting GNews API fetch...');
    try {
        const allUserApiKeys: ApiKey[] = await getApiKeys(); // Get all global API keys
        const gnewsApiKeyEntry = allUserApiKeys.find(key => key.serviceName === 'GNews API');

        if (gnewsApiKeyEntry && gnewsApiKeyEntry.keyValue) {
            console.log(`[GatherGlobalMentionsFlow] GNews API key found. Using key starting with: ${gnewsApiKeyEntry.keyValue.substring(0, 5)}...`);
            const gnewsApiKey = gnewsApiKeyEntry.keyValue;
            const gnewsResult = await fetchGnewsArticles(gnewsApiKey, keywords);
            console.log(`[GatherGlobalMentionsFlow] Fetched ${gnewsResult.articles.length} articles from GNews API.`);
            if (gnewsResult.errors.length > 0) {
                errors.push(...gnewsResult.errors.map(e => `GNews API Error: ${e}`));
            }
            
            const gnewsMentionsTransformed: Partial<Mention>[] = gnewsResult.articles.map((article, index) => {
                const matchedKw = keywords.find(kw => 
                    article.title?.toLowerCase().includes(kw.toLowerCase()) ||
                    article.description?.toLowerCase().includes(kw.toLowerCase())
                ) || keywords[0] || 'unknown';

                return {
                    id: generateGnewsMentionId(article, userId),
                    platform: 'Google News', 
                    source: article.source?.name || article.source?.url || 'GNews',
                    title: article.title || 'No Title',
                    excerpt: article.description || '',
                    url: article.url || '#',
                    timestamp: article.publishedAt || new Date().toISOString(),
                    matchedKeyword: matchedKw,
                };
            });
            allPotentialMentionsPartial.push(...gnewsMentionsTransformed);
            console.log(`[GatherGlobalMentionsFlow] GNews API fetch complete. Added ${gnewsMentionsTransformed.length} mentions.`);
        } else {
            console.log(`[GatherGlobalMentionsFlow] No GNews API key configured in API Management. Skipping GNews API fetch.`);
             errors.push("GNews API key not configured. GNews mentions were not fetched.");
        }
    } catch (error) {
        const errorMsg = `Error fetching or processing GNews API data: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(`[GatherGlobalMentionsFlow] ${errorMsg}`, error);
    }

    // RSS Feed Placeholder
    if (user.assignedRssFeedUrls && user.assignedRssFeedUrls.length > 0) {
        console.log(`[GatherGlobalMentionsFlow] User ${userId} has ${user.assignedRssFeedUrls.length} RSS feeds assigned. RSS processing not fully implemented in this iteration. URLs: ${user.assignedRssFeedUrls.join(', ')}`);
        // Placeholder for future full implementation:
        // For now, you could add a single mock "RSS Processing Incomplete" mention
        // allPotentialMentionsPartial.push({
        //   id: `rss_placeholder_${userId}_${Date.now()}`,
        //   platform: 'RSS Feed',
        //   source: 'Assigned Feeds',
        //   title: 'RSS Feed Content (Processing Pending)',
        //   excerpt: `User has ${user.assignedRssFeedUrls.length} RSS feeds. Full parsing and display will be implemented.`,
        //   url: '#',
        //   timestamp: new Date().toISOString(),
        //   matchedKeyword: 'RSS',
        // });
    }


    const uniqueApiMentionsMap = new Map<string, Partial<Mention>>();
    allPotentialMentionsPartial.forEach(m => {
        if (m.id && typeof m.id === 'string' && m.id.trim() !== "") {
            if (!uniqueApiMentionsMap.has(m.id)) {
                uniqueApiMentionsMap.set(m.id, { ...m, userId }); 
            }
        } else {
            console.warn(`[GatherGlobalMentionsFlow] Found a mention with invalid/missing ID. Title: "${m.title?.substring(0,30)}...", Platform: ${m.platform}. Skipping.`);
        }
    });
    const uniqueApiMentionsFromSources = Array.from(uniqueApiMentionsMap.values());
    console.log(`[GatherGlobalMentionsFlow] Total unique mentions from API sources this run: ${uniqueApiMentionsFromSources.length}.`);


    const mentionsForInitialStorage: Mention[] = [];
    for (const partialApiMention of uniqueApiMentionsFromSources) {
        if (!partialApiMention.id) continue;
        const existingStoredMention = storedMentionsMap.get(partialApiMention.id);
        const currentSentiment = existingStoredMention?.sentiment || 'unknown';
        mentionsForInitialStorage.push({
            userId: userId,
            id: partialApiMention.id,
            platform: partialApiMention.platform || 'Other',
            source: partialApiMention.source || 'Unknown',
            title: partialApiMention.title || 'No Title',
            excerpt: partialApiMention.excerpt || '',
            url: partialApiMention.url || '#',
            timestamp: partialApiMention.timestamp || new Date().toISOString(),
            matchedKeyword: partialApiMention.matchedKeyword || 'unknown',
            sentiment: currentSentiment,
            fetchedAt: new Date().toISOString(),
        } as Mention);
    }

    let initialStoreSuccessCount = 0;
    if (mentionsForInitialStorage.length > 0) {
        console.log(`[GatherGlobalMentionsFlow] Attempting INITIAL BATCH STORE of ${mentionsForInitialStorage.length} mentions for user ${userId}.`);
        const initialStoreResult = await addGlobalMentionsBatch(userId, mentionsForInitialStorage);
        initialStoreSuccessCount = initialStoreResult.successCount;
        if (initialStoreResult.errorCount > 0) {
          errors.push(...initialStoreResult.errors.map(e => `Initial Storage Error: ${e}`));
        }
    }

    const mentionsToConsiderForSentiment = uniqueApiMentionsFromSources.map(partialApiMention => {
        const existingStoredMention = storedMentionsMap.get(partialApiMention.id!);
        const contentChanged = existingStoredMention ?
            ( (partialApiMention.title || 'No Title') !== (existingStoredMention.title || 'No Title') ||
              (partialApiMention.excerpt || '') !== (existingStoredMention.excerpt || '')
            ) : true;
        return {
            ...partialApiMention,
            needsSentimentAnalysis: !existingStoredMention || contentChanged || existingStoredMention.sentiment === 'unknown' || existingStoredMention.sentiment === undefined,
            currentSentiment: existingStoredMention?.sentiment || 'unknown'
        };
    });

    const mentionsNeedingSentimentAnalysis = mentionsToConsiderForSentiment.filter(m => m.needsSentimentAnalysis);
    console.log(`[GatherGlobalMentionsFlow] Found ${mentionsNeedingSentimentAnalysis.length} mentions needing sentiment analysis.`);

    const mentionsToAnalyzeThisRun = mentionsNeedingSentimentAnalysis.slice(0, MAX_SENTIMENT_ANALYSES_PER_RUN);
    const mentionsWithUpdatedSentiment: Mention[] = [];

    if (mentionsToAnalyzeThisRun.length > 0) {
        for (const partialMentionToAnalyze of mentionsToAnalyzeThisRun) {
            try {
                await delay(SENTIMENT_ANALYSIS_DELAY_MS);
                const textToAnalyze = `${partialMentionToAnalyze.title || ''} ${partialMentionToAnalyze.excerpt || ''}`;
                if (!textToAnalyze.trim()) {
                    console.log(`[GatherGlobalMentionsFlow] Skipping sentiment for mention ID "${partialMentionToAnalyze.id}" due to empty text. Setting sentiment to 'neutral'.`);
                    mentionsWithUpdatedSentiment.push({
                        userId: userId, id: partialMentionToAnalyze.id!, platform: partialMentionToAnalyze.platform || 'Other',
                        source: partialMentionToAnalyze.source || 'Unknown', title: partialMentionToAnalyze.title || 'No Title',
                        excerpt: partialMentionToAnalyze.excerpt || '', url: partialMentionToAnalyze.url || '#',
                        timestamp: partialMentionToAnalyze.timestamp || new Date().toISOString(),
                        matchedKeyword: partialMentionToAnalyze.matchedKeyword || 'unknown',
                        sentiment: 'neutral', // Set to neutral if no text
                        fetchedAt: new Date().toISOString(),
                    } as Mention);
                    continue;
                }

                console.log(`[GatherGlobalMentionsFlow] Analyzing sentiment for mention ID: "${partialMentionToAnalyze.id}"`);
                const sentimentResult = await analyzeAdvancedSentiment({ text: textToAnalyze });
                let finalSentiment: Mention['sentiment'] = sentimentResult.error ? 'unknown' : sentimentResult.sentiment;
                if (sentimentResult.error) {
                    errors.push(`Sentiment analysis error for mention "${partialMentionToAnalyze.id}": ${sentimentResult.error}`);
                }
                mentionsWithUpdatedSentiment.push({
                    userId: userId, id: partialMentionToAnalyze.id!, platform: partialMentionToAnalyze.platform || 'Other',
                    source: partialMentionToAnalyze.source || 'Unknown', title: partialMentionToAnalyze.title || 'No Title',
                    excerpt: partialMentionToAnalyze.excerpt || '', url: partialMentionToAnalyze.url || '#',
                    timestamp: partialMentionToAnalyze.timestamp || new Date().toISOString(),
                    matchedKeyword: partialMentionToAnalyze.matchedKeyword || 'unknown',
                    sentiment: finalSentiment, fetchedAt: new Date().toISOString(),
                } as Mention);
            } catch (e) { /* ... error handling as before ... */ }
        }
    }

    let sentimentUpdateSuccessCount = 0;
    if (mentionsWithUpdatedSentiment.length > 0) {
        console.log(`[GatherGlobalMentionsFlow] Attempting to UPDATE ${mentionsWithUpdatedSentiment.length} mentions with new sentiments.`);
        const updateStoreResult = await addGlobalMentionsBatch(userId, mentionsWithUpdatedSentiment);
        sentimentUpdateSuccessCount = updateStoreResult.successCount;
        if (updateStoreResult.errorCount > 0) {
          errors.push(...updateStoreResult.errors.map(e => `Sentiment Update Storage Error: ${e}`));
        }
    }
    
    const totalItemsWrittenOrUpdated = Math.max(initialStoreSuccessCount, sentimentUpdateSuccessCount);
    console.log(`[GatherGlobalMentionsFlow] EXITING FLOW. UserID: ${user.id}. Fetched: ${uniqueApiMentionsFromSources.length}, Stored/Updated: ${totalItemsWrittenOrUpdated}, Errors: ${errors.length}`);
    return {
      totalMentionsFetched: uniqueApiMentionsFromSources.length,
      newMentionsStored: totalItemsWrittenOrUpdated,
      errors,
    };
  }
);

export async function gatherGlobalMentions(input: GatherGlobalMentionsInput): Promise<GatherGlobalMentionsOutput> {
  try {
    console.log(`[gatherGlobalMentions EXPORTED WRAPPER] Called for UserID ${input.userId}. Forwarding to flow runner.`);
    if (!input.userId || typeof input.userId !== 'string' || input.userId.trim() === "") {
        const errorMsg = `[gatherGlobalMentions EXPORTED WRAPPER] Invalid or missing UserID: '${input.userId}'. Aborting.`;
        console.error(errorMsg);
        return { totalMentionsFetched: 0, newMentionsStored: 0, errors: [errorMsg] };
    }
    const result = await gatherGlobalMentionsFlowRunner(input);
    console.log(`[gatherGlobalMentions EXPORTED WRAPPER] Flow runner completed for UserID ${input.userId}.`);
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
