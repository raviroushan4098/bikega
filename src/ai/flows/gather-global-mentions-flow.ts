
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

const lpuMockNewsItems = [
  {
    title: "Edu-Leaders Conclave at LPU Brought Together CBSE School Principals from Across India",
    excerpt: "Edu-Leaders Conclave at LPU focused on innovative educational strategies and future trends, bringing together principals from various CBSE schools.",
    source: "Yes Punjab News",
    timestamp: new Date(Date.now() - 51 * 60 * 1000).toISOString(), // Approx 51 minutes ago
    url: "https://yespunjab.com/edu-leaders-conclave-at-lpu-brought-together-cbse-school-principals-from-across-india/" // Corrected working URL
  },
  {
    title: "LPU Journalism Placements Reach INR 12 LPA: SJMC HoD",
    excerpt: "The School of Journalism and Mass Communication (SJMC) at LPU announced high placements, with the highest package reaching INR 12 LPA.",
    source: "Shiksha (By Mayank Uniyal)",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Approx 2 days ago
    url: "https://www.shiksha.com/mass-communication-media/journalism/news/lpu-journalism-placements-12-lpa-sjmc-hod-p" // Plausible mock direct link
  },
  {
    title: "Internet of Things (IoT): What It Is, How It Works, and Career Paths",
    excerpt: "An article by Satvinder Pal Singh from LPU explores the fundamentals of IoT, its applications, and potential career opportunities in the field.",
    source: "LPU (By Satvinder Pal Singh)",
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Approx 5 days ago
    url: "https://www.lpu.in/news/iot-fundamentals-careers" // Plausible mock direct link to LPU's news section
  },
  {
    title: "Governor of Punjab to Grace LPU’s ‘Operation Sindoor Vijay Yatra’ and Chair Vice Chancellor’s Conference at LPU",
    excerpt: "The Hon'ble Governor of Punjab is scheduled to attend LPU's 'Operation Sindoor Vijay Yatra' event and will also chair a conference of Vice Chancellors.",
    source: "Cityairnews",
    timestamp: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(), // Approx 19 hours ago
    url: "https://www.cityairnews.com/content/governor-punjab-lpu-operation-sindoor-vijay-yatra-vc-conference" // Plausible mock direct link
  },
  {
    title: "Hon'ble Governor of Punjab to Grace LPU's 'Operation Sindoor Vijay Yatra' and Chair Vice Chancellor's Conference at LPU",
    excerpt: "The upcoming 'Operation Sindoor Vijay Yatra' at LPU will be graced by the Hon'ble Governor of Punjab, who will also lead a Vice Chancellor's conference.",
    source: ":: India News Calling ::",
    timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(), // Approx 23 hours ago
    url: "https://www.indianewscalling.com/news/punjab-governor-to-attend-lpu-event-chair-vc-conference" // Plausible mock direct link
  }
];

function fetchGoogleNewsMentionsMock(keywords: string[]): Partial<Mention>[] {
  if (!keywords.length) return [];
  console.log(`[GoogleNewsMentionsMock] Simulating fetch for keywords: ${keywords.join(', ')}`);
  const outputMentions: Partial<Mention>[] = [];
  let mockIdCounter = Date.now();

  const hasLPUKeyword = keywords.some(kw => kw.toLowerCase() === 'lpu');

  if (hasLPUKeyword) {
    lpuMockNewsItems.forEach((newsItem, newsIndex) => {
      outputMentions.push({
        id: `googlenews_mock_lpu_${mockIdCounter++}_${newsIndex}`,
        platform: 'Google News',
        source: newsItem.source,
        title: newsItem.title,
        excerpt: newsItem.excerpt,
        url: newsItem.url, // Using the direct (mock or real) link from the array
        timestamp: newsItem.timestamp,
        matchedKeyword: "LPU",
        sentiment: 'neutral'
      });
    });
  }
  
  const otherKeywords = keywords.filter(kw => kw.toLowerCase() !== 'lpu');
  otherKeywords.slice(0, 2).forEach((kw) => { // Limit other keyword mocks
    outputMentions.push({
      id: `googlenews_mock_${mockIdCounter++}_${kw.replace(/\s+/g, '')}`,
      platform: 'Google News',
      source: 'Google News Mock Source',
      title: `Simulated Top Story regarding ${kw}`,
      excerpt: `This is a simulated Google News article detailing recent developments and discussions related to ${kw}. Key figures and future implications are explored.`,
      url: `https://news.google.com/search?q=${encodeURIComponent(kw)}&mock_id=${mockIdCounter}`, // Other keywords still use search links
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(), // Random within last 7 days
      matchedKeyword: kw,
      sentiment: 'neutral'
    });
  });

  console.log(`[GoogleNewsMentionsMock] Generated ${outputMentions.length} mock Google News mentions.`);
  return outputMentions;
}


function fetchWebMentionsMock(keywords: string[]): Partial<Mention>[] {
  if (!keywords.length) return [];
  console.log(`[WebMentionsMock] Simulating fetch for keywords: ${keywords.join(', ')}`);
  const webMentions: Partial<Mention>[] = [];
  let mockIdCounter = Date.now();

  keywords.slice(0, 3).forEach(kw => { // Limit total keywords processed to keep mock data manageable
    for (let i = 0; i < (Math.random() > 0.5 ? 2 : 1); i++) { // 1 or 2 mentions per keyword
      const domain = ['awesomeblog.com', 'industryinsights.net', 'communityforum.org'][Math.floor(Math.random() * 3)];
      webMentions.push({
        id: `webmention_mock_${mockIdCounter++}_${kw.replace(/\s+/g, '')}`,
        platform: 'Web Mention',
        source: `Article on ${domain}`,
        title: `In-depth Analysis of ${kw} Trends in 2024`,
        excerpt: `A comprehensive blog post discussing the impact of ${kw} on various sectors. This article explores future possibilities and current challenges related to ${kw}.`,
        url: `https://${domain}/article/${kw.replace(/\s+/g, '-')}-trends-2024-${mockIdCounter}`,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 14).toISOString(), // within last 14 days
        matchedKeyword: kw,
        sentiment: Math.random() > 0.5 ? 'positive' : 'neutral', // Random sentiment
      });
    }
  });
  console.log(`[WebMentionsMock] Generated ${webMentions.length} mock web mentions.`);
  return webMentions.slice(0, 4); // Cap total mock web mentions
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

    console.log(`[GatherGlobalMentionsFlow] Phase 0: Fetching existing mentions for user ${userId} from Firestore.`);
    const existingMentionsList = await getGlobalMentionsForUser(userId);
    const storedMentionsMap = new Map<string, Mention>();
    existingMentionsList.forEach(m => {
        if (m.id) storedMentionsMap.set(m.id, m);
    });
    console.log(`[GatherGlobalMentionsFlow] Found ${storedMentionsMap.size} existing mentions in Firestore for user ${userId}.`);


    let allPotentialMentionsPartial: Partial<Mention>[] = [];

    console.log('[GatherGlobalMentionsFlow] Starting Hacker News fetch...');
    const hnMentions = await fetchHackerNewsMentions(keywords);
    allPotentialMentionsPartial.push(...hnMentions);
    console.log(`[GatherGlobalMentionsFlow] Hacker News fetch complete. Found ${hnMentions.length} mentions.`);

    console.log('[GatherGlobalMentionsFlow] Starting Google News (Mock) fetch...');
    const googleNewsMentions = fetchGoogleNewsMentionsMock(keywords);
    allPotentialMentionsPartial.push(...googleNewsMentions);
    console.log(`[GatherGlobalMentionsFlow] Google News (Mock) fetch complete. Found ${googleNewsMentions.length} mentions.`);

    console.log('[GatherGlobalMentionsFlow] Starting Web Mentions (Mock) fetch...');
    const webMentions = fetchWebMentionsMock(keywords);
    allPotentialMentionsPartial.push(...webMentions);
    console.log(`[GatherGlobalMentionsFlow] Web Mentions (Mock) fetch complete. Found ${webMentions.length} mentions.`);

    console.log(`[GatherGlobalMentionsFlow] Counts per platform: HN=${hnMentions.length}, GNewsMock=${googleNewsMentions.length}, WebMock=${webMentions.length}`);
    console.log(`[GatherGlobalMentionsFlow] Total potential mentions from all API sources BEFORE deduplication by ID: ${allPotentialMentionsPartial.length}`);


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
    console.log(`[GatherGlobalMentionsFlow] Total unique mentions from API sources this run (after ID deduplication): ${uniqueApiMentionsFromSources.length}. Platform:IDs sample -> ${uniqueApiMentionsFromSources.slice(0,10).map(m => `${m.platform?.substring(0,1)}:${m.id?.substring(0,15)}`).join(', ')}`);

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
        console.log(`[GatherGlobalMentionsFlow] Phase 1: Attempting INITIAL BATCH STORE of ${mentionsForInitialStorage.length} mentions for user ${userId}. Platform:IDs sample -> ${mentionsForInitialStorage.slice(0,10).map(m => `${m.platform.substring(0,1)}:${m.id?.substring(0,15)}`).join(', ')}`);
        const initialStoreResult = await addGlobalMentionsBatch(userId, mentionsForInitialStorage);
        initialStoreSuccessCount = initialStoreResult.successCount;
        if (initialStoreResult.errorCount > 0) {
          errors.push(...initialStoreResult.errors.map(e => `Initial Storage Error: ${e}`));
        }
        console.log(`[GatherGlobalMentionsFlow] Initial batch storage result for user ${userId}: SuccessCount=${initialStoreResult.successCount}, ErrorCount=${initialStoreResult.errorCount}. Errors: ${initialStoreResult.errors.join('; ')}`);
    } else {
      console.log(`[GatherGlobalMentionsFlow] No new unique mentions from APIs to initially store for user ${userId}.`);
    }

    const mentionsToConsiderForSentiment = uniqueApiMentionsFromSources.map(partialApiMention => {
        const existingStoredMention = storedMentionsMap.get(partialApiMention.id!);
        // Content change check: title OR excerpt. Use defaults if parts are missing.
        const contentChanged = existingStoredMention ?
            ( (partialApiMention.title || 'No Title') !== (existingStoredMention.title || 'No Title') ||
              (partialApiMention.excerpt || '') !== (existingStoredMention.excerpt || '')
            ) : true; // If not existing, it's new, so content "changed" from nothing.

        return {
            ...partialApiMention,
            needsSentimentAnalysis: !existingStoredMention || contentChanged || existingStoredMention.sentiment === 'unknown' || existingStoredMention.sentiment === undefined,
            currentSentiment: existingStoredMention?.sentiment || 'unknown'
        };
    });

    const mentionsNeedingSentimentAnalysis = mentionsToConsiderForSentiment.filter(m => m.needsSentimentAnalysis);
    console.log(`[GatherGlobalMentionsFlow] Phase 2: Found ${mentionsNeedingSentimentAnalysis.length} mentions initially needing sentiment analysis (new, content changed, or sentiment unknown).`);

    const mentionsToAnalyzeThisRun = mentionsNeedingSentimentAnalysis.slice(0, MAX_SENTIMENT_ANALYSES_PER_RUN);
    console.log(`[GatherGlobalMentionsFlow] Will attempt sentiment analysis for up to ${MAX_SENTIMENT_ANALYSES_PER_RUN} mentions. Number to analyze this run: ${mentionsToAnalyzeThisRun.length}. Platform:IDs sample -> ${mentionsToAnalyzeThisRun.slice(0,10).map(m => `${m.platform?.substring(0,1)}:${m.id?.substring(0,15)}`).join(', ')}`);


    const mentionsWithUpdatedSentiment: Mention[] = [];

    if (mentionsToAnalyzeThisRun.length > 0) {
        console.log(`[GatherGlobalMentionsFlow] Analyzing sentiment for ${mentionsToAnalyzeThisRun.length} mentions.`);
        for (const partialMentionToAnalyze of mentionsToAnalyzeThisRun) {
            try {
                console.log(`[GatherGlobalMentionsFlow] Waiting ${SENTIMENT_ANALYSIS_DELAY_MS}ms before sentiment call for: "${partialMentionToAnalyze.id}" (Platform: ${partialMentionToAnalyze.platform})`);
                await delay(SENTIMENT_ANALYSIS_DELAY_MS);

                const textToAnalyze = `${partialMentionToAnalyze.title || ''} ${partialMentionToAnalyze.excerpt || ''}`;
                console.log(`[GatherGlobalMentionsFlow] Analyzing sentiment for mention ID: "${partialMentionToAnalyze.id}", Platform: ${partialMentionToAnalyze.platform}, Title: "${partialMentionToAnalyze.title?.substring(0,30)}...", Excerpt (first 30): "${partialMentionToAnalyze.excerpt?.substring(0,30)}..."`);
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

                mentionsWithUpdatedSentiment.push({
                    userId: userId,
                    id: partialMentionToAnalyze.id!,
                    platform: partialMentionToAnalyze.platform || 'Other',
                    source: partialMentionToAnalyze.source || 'Unknown',
                    title: partialMentionToAnalyze.title || 'No Title',
                    excerpt: partialMentionToAnalyze.excerpt || '',
                    url: partialMentionToAnalyze.url || '#',
                    timestamp: partialMentionToAnalyze.timestamp || new Date().toISOString(),
                    matchedKeyword: partialMentionToAnalyze.matchedKeyword || 'unknown',
                    sentiment: finalSentiment,
                    fetchedAt: new Date().toISOString(),
                } as Mention);

            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                errors.push(`Exception during sentiment analysis for mention "${partialMentionToAnalyze.id}": ${errorMsg}`);
                console.error(`[GatherGlobalMentionsFlow] CRITICAL EXCEPTION during sentiment analysis for mention "${partialMentionToAnalyze.id}" (Title: ${partialMentionToAnalyze.title?.substring(0,30)}...):`, e);
                
                // If sentiment analysis itself errors out, still try to push a version of the mention
                // with 'unknown' sentiment so it can be stored/updated, rather than losing the item.
                mentionsWithUpdatedSentiment.push({
                    userId: userId,
                    id: partialMentionToAnalyze.id!, // Assert non-null as it's checked earlier
                    platform: partialMentionToAnalyze.platform || 'Other',
                    source: partialMentionToAnalyze.source || 'Unknown Source',
                    title: partialMentionToAnalyze.title || 'No Title Provided',
                    excerpt: partialMentionToAnalyze.excerpt || 'No Excerpt Provided',
                    url: partialMentionToAnalyze.url || '#',
                    timestamp: (partialMentionToAnalyze.timestamp instanceof Date)
                                ? partialMentionToAnalyze.timestamp.toISOString()
                                : String(partialMentionToAnalyze.timestamp || new Date().toISOString()),
                    matchedKeyword: partialMentionToAnalyze.matchedKeyword || 'unknown',
                    sentiment: 'unknown', // Default sentiment on error
                    fetchedAt: new Date().toISOString(),
                } as Mention);
            }
        }
        console.log(`[GatherGlobalMentionsFlow] Finished sentiment analysis loop for ${mentionsToAnalyzeThisRun.length} mentions.`);
    } else {
        console.log('[GatherGlobalMentionsFlow] No mentions selected for sentiment analysis in this run.');
    }

    let sentimentUpdateSuccessCount = 0;
    if (mentionsWithUpdatedSentiment.length > 0) {
        console.log(`[GatherGlobalMentionsFlow] Phase 3: Attempting to UPDATE ${mentionsWithUpdatedSentiment.length} mentions with new sentiments in Firestore. Platform:IDs sample -> ${mentionsWithUpdatedSentiment.slice(0,10).map(m => `${m.platform.substring(0,1)}:${m.id?.substring(0,15)}`).join(', ')}`);

        const updateStoreResult = await addGlobalMentionsBatch(userId, mentionsWithUpdatedSentiment);
        sentimentUpdateSuccessCount = updateStoreResult.successCount;
        if (updateStoreResult.errorCount > 0) {
          errors.push(...updateStoreResult.errors.map(e => `Sentiment Update Storage Error: ${e}`));
        }
        console.log(`[GatherGlobalMentionsFlow] Batch sentiment update result for user ${userId}: SuccessCount=${updateStoreResult.successCount}, ErrorCount=${updateStoreResult.errorCount}. Errors: ${updateStoreResult.errors.join('; ')}`);
    } else {
      console.log(`[GatherGlobalMentionsFlow] No mentions had their sentiment updated for final storage for user ${userId}.`);
    }

    console.log("======================================================================");
    console.log(`[GatherGlobalMentionsFlow] EXITING FLOW. UserID: ${user.id} (${user.name}). Timestamp: ${new Date().toISOString()}`);

    // Determine how many items were truly new OR had their sentiment actively updated and re-saved.
    // This logic assumes initialStore includes items that *might* get their sentiment updated later in this flow.
    // A more accurate 'newOrUpdatedMentionsStored' might be a combination of:
    // 1. Items in `initialStoreSuccessCount` that were NOT part of `mentionsWithUpdatedSentiment` (truly new, sentiment not analyzed this run).
    // 2. Items in `sentimentUpdateSuccessCount` (had sentiment analyzed/updated this run).
    // However, `addGlobalMentionsBatch` uses set({merge:true}), so `initialStoreSuccessCount` represents writes,
    // and `sentimentUpdateSuccessCount` also represents writes (potentially overwriting).
    // The `Math.max` approach is a simplification assuming distinct sets or just taking the larger number of writes.
    // A more precise count would require tracking IDs. For now, this reflects the total # of docs written/overwritten.
    const totalItemsWrittenOrUpdated = Math.max(initialStoreSuccessCount, sentimentUpdateSuccessCount);

    console.log(`  Summary: Unique API Mentions Fetched This Run: ${uniqueApiMentionsFromSources.length}, Items Initially Stored: ${initialStoreSuccessCount}, Items with Sentiment Updated in DB: ${sentimentUpdateSuccessCount}, Total items created/updated in DB (approx): ${totalItemsWrittenOrUpdated}, Errors during flow: ${errors.length}`);
    if(errors.length > 0) console.log(`  Encountered errors: ${errors.map(e => `"${e}"`).join('; ')}`);
    console.log("======================================================================");
    return {
      totalMentionsFetched: uniqueApiMentionsFromSources.length,
      newMentionsStored: totalItemsWrittenOrUpdated, // Represents # of docs successfully written to Firestore
      errors,
    };
  }
);

export async function gatherGlobalMentions(input: GatherGlobalMentionsInput): Promise<GatherGlobalMentionsOutput> {
  try {
    console.log(`[gatherGlobalMentions EXPORTED WRAPPER] Called for UserID ${input.userId}. Forwarding to flow runner.`);
    if (!input.userId || typeof input.userId !== 'string' || input.userId.trim() === "") {
        const errorMsg = `[gatherGlobalMentions EXPORTED WRAPPER] Invalid or missing UserID: '${input.userId}'. Aborting flow call.`;
        console.error(errorMsg);
        return { totalMentionsFetched: 0, newMentionsStored: 0, errors: [errorMsg] };
    }
    const result = await gatherGlobalMentionsFlowRunner(input);
    console.log(`[gatherGlobalMentions EXPORTED WRAPPER] Flow runner completed for UserID ${input.userId}. Result: TotalFetched=${result.totalMentionsFetched}, NewStored=${result.newMentionsStored}, Errors=${result.errors.length}`);
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


    

    