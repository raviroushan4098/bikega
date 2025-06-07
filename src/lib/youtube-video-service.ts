
'use server';

import type { YoutubeVideo, YouTubeMentionItem } from '@/types';
import { getApiKeys } from './api-key-service';
import { db } from './firebase';
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { analyzeAdvancedSentiment } from '@/ai/flows/advanced-sentiment-flow';

const YOUTUBE_API_KEY_SERVICE_NAME = "YouTube Data API Key";
const FIRESTORE_YOUTUBE_MENTIONS_COLLECTION = 'youtube_mentions';
const FIRESTORE_MENTIONS_SUBCOLLECTION = 'mentions';

const COMMENTS_TO_FETCH_FOR_SENTIMENT = 10; // For assigned videos
const COMMENT_SENTIMENT_ANALYSIS_DELAY_MS = 2000; // For assigned videos
const COMMENTS_TO_FETCH_FOR_MENTION_SENTIMENT = 5; // For keyword mentions
const COMMENT_MENTION_SENTIMENT_ANALYSIS_DELAY_MS = 2500; // Slightly longer for mentions due to potential volume


const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface YouTubeApiCommentSnippet {
  textDisplay: string;
  textOriginal: string;
  authorDisplayName: string;
  publishedAt: string;
  updatedAt: string;
}
interface YouTubeApiTopLevelComment {
  kind: "youtube#comment";
  etag: string;
  id: string;
  snippet: YouTubeApiCommentSnippet;
}
interface YouTubeApiCommentThreadSnippet {
  videoId: string;
  topLevelComment: YouTubeApiTopLevelComment;
  canReply: boolean;
  totalReplyCount: number;
  isPublic: boolean;
}
interface YouTubeApiCommentThread {
  kind: "youtube#commentThread";
  etag: string;
  id: string; // Comment thread ID
  snippet: YouTubeApiCommentThreadSnippet;
}
interface YouTubeApiCommentThreadListResponse {
  kind: "youtube#commentThreadListResponse";
  etag: string;
  items: YouTubeApiCommentThread[];
  nextPageToken?: string;
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
}


interface YouTubeApiVideoItemStatistics {
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
  favoriteCount?: string; 
}
interface YouTubeApiVideoItemSnippet {
  publishedAt: string;
  channelId: string;
  title: string;
  description: string;
  thumbnails: {
    default?: { url: string; width?: number; height?: number };
    medium?: { url: string; width?: number; height?: number };
    high?: { url: string; width?: number; height?: number };
    standard?: { url: string; width?: number; height?: number };
    maxres?: { url: string; width?: number; height?: number };
  };
  channelTitle: string;
  tags?: string[];
  categoryId?: string;
  liveBroadcastContent?: string;
  localized?: {
    title: string;
    description: string;
  };
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
}

interface YouTubeApiVideoListItem { 
  kind: "youtube#video";
  etag: string;
  id: string; 
  snippet: YouTubeApiVideoItemSnippet;
  statistics?: YouTubeApiVideoItemStatistics;
}

interface YouTubeApiSearchItem { 
  kind: "youtube#searchResult";
  etag: string;
  id: {
    kind: string; 
    videoId: string;
  };
  snippet: YouTubeApiVideoItemSnippet; 
}


interface YouTubeApiSearchResponse {
  kind: "youtube#searchListResponse";
  etag: string;
  items: YouTubeApiSearchItem[];
  nextPageToken?: string;
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
}

interface YouTubeApiVideoListResponse {
  kind: "youtube#videoListResponse";
  etag: string;
  items: YouTubeApiVideoListItem[];
  nextPageToken?: string;
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
}


function extractYouTubeVideoId(url: string): string | null {
  let videoId: string | null = null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      videoId = urlObj.searchParams.get('v');
    } else if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.substring(1);
    }
  } catch (e) {
    // Invalid URL, try regex
  }

  if (!videoId) {
    const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/;
    const match = url.match(regex);
    if (match && match[1]) {
      videoId = match[1];
    }
  }
  return videoId;
}

export async function fetchVideoDetailsFromYouTubeAPI(
  videoUrlOrId: string,
  assignedToUserId: string,
  assignedToUserName?: string
): Promise<YoutubeVideo | null> {
  const videoId = extractYouTubeVideoId(videoUrlOrId) || videoUrlOrId;
  if (!videoId) {
    console.error(`[youtube-video-service] Could not extract valid video ID from: ${videoUrlOrId}`);
    return null;
  }

  const apiKeys = await getApiKeys();
  const youtubeApiKeyEntry = apiKeys.find(k => k.serviceName === YOUTUBE_API_KEY_SERVICE_NAME);

  const baseVideoData: Omit<YoutubeVideo, 'title' | 'thumbnailUrl' | 'channelTitle' | 'likeCount' | 'commentCount' | 'viewCount' | 'dataAiHint' | 'sentiment'> = {
    id: videoId,
    url: videoUrlOrId.startsWith('http') ? videoUrlOrId : `https://www.youtube.com/watch?v=${videoId}`,
    assignedToUserId: assignedToUserId,
    assignedToUserName: assignedToUserName,
  };

  if (!youtubeApiKeyEntry || !youtubeApiKeyEntry.keyValue) {
    console.warn(`[youtube-video-service] '${YOUTUBE_API_KEY_SERVICE_NAME}' not found or empty in API Management. Cannot fetch video details for ID '${videoId}'.`);
    return {
      ...baseVideoData,
      title: `Video ID: ${videoId} (Details unavailable - Check API Key)`,
      thumbnailUrl: 'https://placehold.co/320x180.png?text=No+API+Key',
      dataAiHint: 'video placeholder',
      channelTitle: 'N/A',
      sentiment: 'unknown',
    };
  }
  const apiKey = youtubeApiKeyEntry.keyValue;
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,statistics`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[youtube-video-service] YouTube API error for video ID '${videoId}' (${response.status}):`, errorData.error?.message || response.statusText);
      return {
        ...baseVideoData,
        title: `Video ID: ${videoId} (API Error)`,
        thumbnailUrl: 'https://placehold.co/320x180.png?text=API+Error',
        dataAiHint: 'video error',
        channelTitle: 'N/A',
        sentiment: 'unknown',
      };
    }
    const data: YouTubeApiVideoListResponse = await response.json();
    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      const snippet = item.snippet;
      const statistics = item.statistics;

      let hint = "youtube video";
      if (snippet.description && snippet.description.length > 10) {
        hint = snippet.description.split(" ").slice(0, 2).join(" ");
      } else if (snippet.title) {
         hint = snippet.title.split(" ").slice(0, 2).join(" ");
      }

      return {
        ...baseVideoData,
        title: snippet.title || 'N/A',
        thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || 'https://placehold.co/320x180.png',
        channelTitle: snippet.channelTitle || 'N/A',
        likeCount: statistics?.likeCount ? parseInt(statistics.likeCount, 10) : 0,
        commentCount: statistics?.commentCount ? parseInt(statistics.commentCount, 10) : 0,
        viewCount: statistics?.viewCount ? parseInt(statistics.viewCount, 10) : 0,
        dataAiHint: hint.toLowerCase(),
        sentiment: 'unknown', // Sentiment will be analyzed in batch function
      };
    }
    console.warn(`[youtube-video-service] Video ID '${videoId}' not found via YouTube API.`);
    return {
        ...baseVideoData,
        title: `Video ID: ${videoId} (Not found by API)`,
        thumbnailUrl: 'https://placehold.co/320x180.png?text=Not+Found',
        dataAiHint: 'video notfound',
        channelTitle: 'N/A',
        sentiment: 'unknown',
      };
  } catch (error) {
    console.error(`[youtube-video-service] Error fetching from YouTube API for video ID '${videoId}': `, error);
     return {
        ...baseVideoData,
        title: `Video ID: ${videoId} (Fetch Error)`,
        thumbnailUrl: 'https://placehold.co/320x180.png?text=Fetch+Error',
        dataAiHint: 'video fetcherror',
        channelTitle: 'N/A',
        sentiment: 'unknown',
      };
  }
}

export async function fetchBatchVideoDetailsFromYouTubeAPI(
  videoIds: string[],
  assignedToUserMap: Record<string, { userId: string, userName?: string }>
): Promise<YoutubeVideo[]> {
  if (!videoIds || videoIds.length === 0) {
    return [];
  }

  const apiKeys = await getApiKeys();
  const youtubeApiKeyEntry = apiKeys.find(k => k.serviceName === YOUTUBE_API_KEY_SERVICE_NAME);

  const createPlaceholderVideo = (videoId: string, status: "No API Key" | "API Error" | "Not Found" | "Fetch Error", hint: string): YoutubeVideo => {
    const assignment = assignedToUserMap[videoId] || { userId: 'unknown_user_id', userName: 'Unknown User' };
    return {
      id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: `Video ID: ${videoId} (${status})`,
      thumbnailUrl: `https://placehold.co/320x180.png?text=${status.replace(/\s/g, '+')}`,
      channelTitle: 'N/A',
      assignedToUserId: assignment.userId,
      assignedToUserName: assignment.userName,
      sentiment: 'unknown',
      dataAiHint: hint,
      viewCount: 0, likeCount: 0, commentCount: 0,
    };
  };

  if (!youtubeApiKeyEntry || !youtubeApiKeyEntry.keyValue) {
    console.warn(`[youtube-video-service (batch)] '${YOUTUBE_API_KEY_SERVICE_NAME}' not found. Cannot batch fetch details.`);
    return videoIds.map(videoId => createPlaceholderVideo(videoId, "No API Key", "video placeholder"));
  }
  const apiKey = youtubeApiKeyEntry.keyValue;

  const CHUNK_SIZE = 50; 
  const fetchedVideos: YoutubeVideo[] = [];

  for (let i = 0; i < videoIds.length; i += CHUNK_SIZE) {
    const chunk = videoIds.slice(i, i + CHUNK_SIZE);
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${chunk.join(',')}&key=${apiKey}&part=snippet,statistics`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[youtube-video-service (batch)] YouTube API error (${response.status}):`, errorData.error?.message || response.statusText);
        chunk.forEach(videoId => fetchedVideos.push(createPlaceholderVideo(videoId, "API Error", "video error")));
        continue;
      }
      const data: YouTubeApiVideoListResponse = await response.json();
      
      for (const item of data.items || []) {
          const videoIdFromApi = item.id;
          const snippet = item.snippet;
          const statistics = item.statistics;
          const assignment = assignedToUserMap[videoIdFromApi] || { userId: 'unknown_user_id', userName: 'Unknown User' };

          let hint = "youtube video";
          if (snippet.description && snippet.description.length > 10) {
            hint = snippet.description.split(" ").slice(0, 2).join(" ");
          } else if (snippet.title) {
            hint = snippet.title.split(" ").slice(0, 2).join(" ");
          }

          let videoSentiment: YoutubeVideo['sentiment'] = 'unknown';
          let aggregatedComments = "";

          // Fetch comments for sentiment analysis
          const commentsUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoIdFromApi}&key=${apiKey}&maxResults=${COMMENTS_TO_FETCH_FOR_SENTIMENT}&order=relevance&textFormat=plainText`;
          try {
            console.log(`[youtube-video-service (batch)] Fetching comments for video ID ${videoIdFromApi} for sentiment analysis.`);
            const commentsResponse = await fetch(commentsUrl);
            if (commentsResponse.ok) {
              const commentsData: YouTubeApiCommentThreadListResponse = await commentsResponse.json();
              if (commentsData.items && commentsData.items.length > 0) {
                aggregatedComments = commentsData.items.map(commentThread => commentThread.snippet.topLevelComment.snippet.textOriginal).join("\n");
              } else {
                 console.log(`[youtube-video-service (batch)] No comments found for video ${videoIdFromApi} to analyze sentiment. Defaulting to 'neutral'.`);
                 videoSentiment = 'neutral'; // No comments, so neutral sentiment.
              }
            } else {
              const commentError = await commentsResponse.json().catch(() => ({}));
              console.warn(`[youtube-video-service (batch)] Error fetching comments for video ${videoIdFromApi} (${commentsResponse.status}): ${commentError.error?.message || commentsResponse.statusText}. Defaulting to 'unknown' sentiment.`);
            }
          } catch (commentFetchError) {
             console.error(`[youtube-video-service (batch)] Exception fetching comments for ${videoIdFromApi}: `, commentFetchError);
          }
          
          if (aggregatedComments) {
            console.log(`[youtube-video-service (batch)] Analyzing sentiment for video ${videoIdFromApi}. Delaying for ${COMMENT_SENTIMENT_ANALYSIS_DELAY_MS}ms.`);
            await delay(COMMENT_SENTIMENT_ANALYSIS_DELAY_MS);
            const sentimentResult = await analyzeAdvancedSentiment({ text: aggregatedComments });
             console.log(`[youtube-video-service (batch)] Sentiment for video ${videoIdFromApi}: ${sentimentResult.sentiment} (Error: ${sentimentResult.error})`);
            videoSentiment = sentimentResult.sentiment;
            if (sentimentResult.error) {
              console.warn(`[youtube-video-service (batch)] Sentiment analysis error for video ${videoIdFromApi}: ${sentimentResult.error}. Defaulting to 'unknown'.`);
            }
          } else if (videoSentiment === 'unknown') { // If not already set to 'neutral' due to no comments
            console.log(`[youtube-video-service (batch)] No comment text to analyze for video ${videoIdFromApi}. Defaulting to 'unknown' sentiment.`);
          }


          fetchedVideos.push({
            id: videoIdFromApi,
            url: `https://www.youtube.com/watch?v=${videoIdFromApi}`,
            title: snippet.title || 'N/A',
            thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || 'https://placehold.co/320x180.png',
            channelTitle: snippet.channelTitle || 'N/A',
            likeCount: statistics?.likeCount ? parseInt(statistics.likeCount, 10) : 0,
            commentCount: statistics?.commentCount ? parseInt(statistics.commentCount, 10) : 0,
            viewCount: statistics?.viewCount ? parseInt(statistics.viewCount, 10) : 0,
            assignedToUserId: assignment.userId,
            assignedToUserName: assignment.userName,
            sentiment: videoSentiment,
            dataAiHint: hint.toLowerCase(),
          });
      }
      // Handle any IDs in the chunk that were not found by the API
      const foundIdsInChunk = new Set(data.items?.map(item => item.id));
      chunk.forEach(videoId => {
        if (!foundIdsInChunk.has(videoId)) {
          fetchedVideos.push(createPlaceholderVideo(videoId, "Not Found", "video notfound"));
        }
      });

    } catch (error) {
      console.error(`[youtube-video-service (batch)] Error batch fetching from YouTube API: `, error);
      chunk.forEach(videoId => fetchedVideos.push(createPlaceholderVideo(videoId, "Fetch Error", "video fetcherror")));
    }
  }
  return fetchedVideos;
}

export async function addYouTubeMentionsBatch(userId: string, mentions: YouTubeMentionItem[]): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    const msg = '[youtube-video-service (addYouTubeMentionsBatch)] Invalid or missing userId provided.';
    console.error(msg);
    return { successCount: 0, errorCount: mentions.length, errors: [msg] };
  }

  if (!mentions || mentions.length === 0) {
    console.log(`[youtube-video-service (addYouTubeMentionsBatch)] No mentions provided for user '${userId}'. Nothing to store.`);
    return { successCount: 0, errorCount: 0, errors: [] };
  }

  const batch = writeBatch(db);
  const localErrors: string[] = [];
  let itemsInBatch = 0;

  for (const mention of mentions) {
    if (!mention.id || typeof mention.id !== 'string' || mention.id.trim() === "") {
      const skipMsg = `Skipping YouTube mention due to missing or invalid ID. Title: "${mention.title?.substring(0, 30)}..." for user '${userId}'.`;
      console.warn(`[youtube-video-service (addYouTubeMentionsBatch)] ${skipMsg}`);
      localErrors.push(skipMsg);
      continue;
    }

    const mentionDocRef = doc(db, FIRESTORE_YOUTUBE_MENTIONS_COLLECTION, userId, FIRESTORE_MENTIONS_SUBCOLLECTION, mention.id);
    
    const mentionDataToSave = {
      ...mention, 
      userId: userId, // Ensure the primary userId for the subcollection path is explicitly set on the item.
      fetchedAt: serverTimestamp(), 
    };
    
    batch.set(mentionDocRef, mentionDataToSave, { merge: true });
    itemsInBatch++;
  }

  if (itemsInBatch === 0) {
    const finalMsg = `No valid YouTube mentions to commit for user '${userId}'. Total initially: ${mentions.length}.`;
    console.log(`[youtube-video-service (addYouTubeMentionsBatch)] ${finalMsg}`);
    return { successCount: 0, errorCount: localErrors.length, errors: localErrors };
  }

  console.log(`[youtube-video-service (addYouTubeMentionsBatch)] Attempting to commit batch with ${itemsInBatch} YouTube mentions for user '${userId}'.`);
  try {
    await batch.commit();
    console.log(`[youtube-video-service (addYouTubeMentionsBatch)] SUCCESS: Batch committed ${itemsInBatch} YouTube mentions for user '${userId}'.`);
    return { successCount: itemsInBatch, errorCount: localErrors.length, errors: localErrors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown batch.commit error for YouTube mentions.';
    console.error(`[youtube-video-service (addYouTubeMentionsBatch)] FAILURE: Error committing batch for user '${userId}'. Error: ${errorMessage}`, error);
    localErrors.push(`Batch Commit Failed for YouTube mentions for user '${userId}': ${errorMessage}`);
    return { successCount: 0, errorCount: itemsInBatch + localErrors.length, errors: localErrors };
  }
}


export async function searchYouTubeVideosByKeywords(
  keywords: string[]
): Promise<{ mentions: YouTubeMentionItem[], error?: string }> {
  if (!keywords || keywords.length === 0) {
    return { mentions: [] };
  }

  const apiKeys = await getApiKeys();
  const youtubeApiKeyEntry = apiKeys.find(k => k.serviceName === YOUTUBE_API_KEY_SERVICE_NAME);

  if (!youtubeApiKeyEntry || !youtubeApiKeyEntry.keyValue) {
    const errorMsg = `'${YOUTUBE_API_KEY_SERVICE_NAME}' not found. Cannot search YouTube.`;
    console.warn(`[youtube-video-service (search)] ${errorMsg}`);
    return { mentions: [], error: errorMsg };
  }
  const apiKey = youtubeApiKeyEntry.keyValue;

  const query = keywords.map(kw => `"${kw.trim()}"`).join(' OR ');
  const maxResults = 25; 
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const searchFields = "items(id/videoId,snippet(publishedAt,title,description,thumbnails/default/url,channelTitle))";
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&order=date&publishedAfter=${encodeURIComponent(twentyFourHoursAgo)}&key=${apiKey}&fields=${encodeURIComponent(searchFields)}`;
  
  let initialSearchResults: YouTubeApiSearchItem[] = [];

  try {
    console.log(`[youtube-video-service (search)] Searching YouTube with query: "${query}", publishedAfter: ${twentyFourHoursAgo}, maxResults: ${maxResults}`);
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      const errorData = await searchResponse.json().catch(() => ({}));
      const errorMsg = `YouTube API search.list error (${searchResponse.status}): ${errorData.error?.message || searchResponse.statusText}`;
      console.error(`[youtube-video-service (search)] ${errorMsg}`);
      return { mentions: [], error: errorMsg };
    }
    const searchData: YouTubeApiSearchResponse = await searchResponse.json();
    initialSearchResults = searchData.items || [];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error during YouTube search.list call.";
    console.error(`[youtube-video-service (search)] Error during YouTube search: ${errorMsg}`, error);
    return { mentions: [], error: errorMsg };
  }

  if (initialSearchResults.length === 0) {
    console.log(`[youtube-video-service (search)] No initial search results from YouTube API for keywords: "${keywords.join(', ')}"`);
    return { mentions: [] };
  }

  const relevantVideoIds: string[] = [];
  const searchResultDetailsMap = new Map<string, { searchItem: YouTubeApiSearchItem; matchedKws: string[] }>();

  for (const item of initialSearchResults) {
    if (!item.id?.videoId) continue;
    const videoId = item.id.videoId;
    const titleLower = item.snippet.title.toLowerCase();
    const descriptionLower = item.snippet.description.toLowerCase();

    const matchedKws = keywords.filter(kw => {
      const kwLower = kw.toLowerCase();
      return titleLower.includes(kwLower) || descriptionLower.includes(kwLower);
    });

    if (matchedKws.length > 0) {
      relevantVideoIds.push(videoId);
      searchResultDetailsMap.set(videoId, { searchItem: item, matchedKws });
    }
  }

  if (relevantVideoIds.length === 0) {
    console.log(`[youtube-video-service (search)] No search results contained specified keywords in title/description for: "${keywords.join(', ')}"`);
    return { mentions: [] };
  }

  let fetchedMentions: YouTubeMentionItem[] = [];
  const CHUNK_SIZE_STATS = 50; 

  for (let i = 0; i < relevantVideoIds.length; i += CHUNK_SIZE_STATS) {
    const chunkVideoIds = relevantVideoIds.slice(i, i + CHUNK_SIZE_STATS);
    const statsFields = "items(id,snippet(title,description,channelTitle,publishedAt,thumbnails/default/url),statistics(viewCount,likeCount,commentCount))";
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${chunkVideoIds.join(',')}&key=${apiKey}&fields=${encodeURIComponent(statsFields)}`;
    
    try {
      const statsResponse = await fetch(statsUrl);
      if (!statsResponse.ok) {
        const errorData = await statsResponse.json().catch(() => ({}));
        console.error(`[youtube-video-service (search)] YouTube API videos.list error (${statsResponse.status}): ${errorData.error?.message || statsResponse.statusText} for IDs: ${chunkVideoIds.join(',')}`);
        chunkVideoIds.forEach(vid => {
            const details = searchResultDetailsMap.get(vid);
            if (details) {
                 fetchedMentions.push({
                    id: vid, url: `https://www.youtube.com/watch?v=${vid}`, title: details.searchItem.snippet.title,
                    thumbnailUrl: details.searchItem.snippet.thumbnails?.default?.url || 'https://placehold.co/120x90.png',
                    channelTitle: details.searchItem.snippet.channelTitle, publishedAt: details.searchItem.snippet.publishedAt,
                    descriptionSnippet: details.searchItem.snippet.description.substring(0, 100) + (details.searchItem.snippet.description.length > 100 ? '...' : ''),
                    matchedKeywords: details.matchedKws, dataAiHint: details.searchItem.snippet.title.split(" ").slice(0, 2).join(" ").toLowerCase() || "youtube video",
                    viewCount: 0, likeCount: 0, commentCount: 0, sentiment: 'unknown'
                });
            }
        });
        continue;
      }
      const statsData: YouTubeApiVideoListResponse = await statsResponse.json();

      for (const videoStatsItem of statsData.items || []) {
        const videoId = videoStatsItem.id;
        const details = searchResultDetailsMap.get(videoId);
        if (details) {
          const snippet = videoStatsItem.snippet; 
          const statistics = videoStatsItem.statistics;
          let hint = "youtube video";
          if (snippet.title) { hint = snippet.title.split(" ").slice(0, 2).join(" ").toLowerCase(); }
          
          let mentionSentiment: YouTubeMentionItem['sentiment'] = 'unknown';
          let aggregatedCommentsText = "";

          // Fetch comments for sentiment
          const commentsUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&key=${apiKey}&maxResults=${COMMENTS_TO_FETCH_FOR_MENTION_SENTIMENT}&order=relevance&textFormat=plainText`;
          try {
            console.log(`[youtube-video-service (search)] Fetching comments for mentioned video ID ${videoId}.`);
            const commentsResp = await fetch(commentsUrl);
            if (commentsResp.ok) {
              const commentsData: YouTubeApiCommentThreadListResponse = await commentsResp.json();
              if (commentsData.items && commentsData.items.length > 0) {
                aggregatedCommentsText = commentsData.items.map(ct => ct.snippet.topLevelComment.snippet.textOriginal).join("\n");
              } else {
                console.log(`[youtube-video-service (search)] No comments for mention ${videoId}, sentiment 'neutral'.`);
                mentionSentiment = 'neutral';
              }
            } else {
              console.warn(`[youtube-video-service (search)] Error fetching comments for mention ${videoId} (${commentsResp.status}). Sentiment 'unknown'.`);
            }
          } catch (e) {
            console.error(`[youtube-video-service (search)] Exception fetching comments for mention ${videoId}: `, e);
          }

          if (aggregatedCommentsText) {
            console.log(`[youtube-video-service (search)] Analyzing sentiment for mention ${videoId}. Delaying ${COMMENT_MENTION_SENTIMENT_ANALYSIS_DELAY_MS}ms.`);
            await delay(COMMENT_MENTION_SENTIMENT_ANALYSIS_DELAY_MS);
            const sentimentRes = await analyzeAdvancedSentiment({ text: aggregatedCommentsText });
            console.log(`[youtube-video-service (search)] Sentiment for mention ${videoId}: ${sentimentRes.sentiment} (Error: ${sentimentRes.error})`);
            mentionSentiment = sentimentRes.sentiment;
            if(sentimentRes.error) console.warn(`[youtube-video-service (search)] Sentiment analysis error for mention ${videoId}: ${sentimentRes.error}.`);
          } else if (mentionSentiment === 'unknown') {
             console.log(`[youtube-video-service (search)] No comment text for mention ${videoId}, sentiment 'unknown'.`);
          }

          fetchedMentions.push({
            id: videoId, url: `https://www.youtube.com/watch?v=${videoId}`, title: snippet.title,
            thumbnailUrl: snippet.thumbnails?.default?.url || 'https://placehold.co/120x90.png',
            channelTitle: snippet.channelTitle, publishedAt: snippet.publishedAt,
            descriptionSnippet: snippet.description.substring(0, 100) + (snippet.description.length > 100 ? '...' : ''),
            matchedKeywords: details.matchedKws, dataAiHint: hint,
            viewCount: statistics?.viewCount ? parseInt(statistics.viewCount, 10) : 0,
            likeCount: statistics?.likeCount ? parseInt(statistics.likeCount, 10) : 0,
            commentCount: statistics?.commentCount ? parseInt(statistics.commentCount, 10) : 0,
            sentiment: mentionSentiment,
          });
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error during YouTube videos.list call.";
      console.error(`[youtube-video-service (search)] Error during YouTube videos.list: ${errorMsg}`, error);
      chunkVideoIds.forEach(vid => {
            const details = searchResultDetailsMap.get(vid);
            if (details) {
                 fetchedMentions.push({
                    id: vid, url: `https://www.youtube.com/watch?v=${vid}`, title: details.searchItem.snippet.title,
                    thumbnailUrl: details.searchItem.snippet.thumbnails?.default?.url || 'https://placehold.co/120x90.png',
                    channelTitle: details.searchItem.snippet.channelTitle, publishedAt: details.searchItem.snippet.publishedAt,
                    descriptionSnippet: details.searchItem.snippet.description.substring(0, 100) + (details.searchItem.snippet.description.length > 100 ? '...' : ''),
                    matchedKeywords: details.matchedKws, dataAiHint: details.searchItem.snippet.title.split(" ").slice(0, 2).join(" ").toLowerCase() || "youtube video",
                    viewCount: 0, likeCount: 0, commentCount: 0, sentiment: 'unknown'
                });
            }
        });
    }
  }
  
  fetchedMentions.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  console.log(`[youtube-video-service (search)] Found ${fetchedMentions.length} relevant YouTube mentions with stats & sentiment for keywords: "${keywords.join(', ')}"`);
  return { mentions: fetchedMentions };
}

export async function getStoredYouTubeMentions(userId: string): Promise<YouTubeMentionItem[]> {
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    console.warn('[youtube-video-service (getStoredYouTubeMentions)] Invalid or missing userId provided.');
    return [];
  }
  const mentionsPath = `${FIRESTORE_YOUTUBE_MENTIONS_COLLECTION}/${userId}/${FIRESTORE_MENTIONS_SUBCOLLECTION}`;
  console.log(`[youtube-video-service (getStoredYouTubeMentions)] Fetching stored YouTube mentions for user ${userId} from '${mentionsPath}'.`);
  
  try {
    const mentionsCollectionRef = collection(db, FIRESTORE_YOUTUBE_MENTIONS_COLLECTION, userId, FIRESTORE_MENTIONS_SUBCOLLECTION);
    // DEBUG: Simplify query to only order by publishedAt.
    // Original: const q = query(mentionsCollectionRef, orderBy('publishedAt', 'desc'), orderBy('fetchedAt', 'desc'));
    const q = query(mentionsCollectionRef, orderBy('publishedAt', 'desc'));
    console.log(`[youtube-video-service (getStoredYouTubeMentions)] Using simplified query: orderBy('publishedAt', 'desc') for user ${userId}.`);
    
    const querySnapshot = await getDocs(q);
    console.log(`[youtube-video-service (getStoredYouTubeMentions)] Firestore query for user '${userId}' returned ${querySnapshot.docs.length} documents.`);

    const mentions = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        url: data.url || `https://www.youtube.com/watch?v=${docSnap.id}`,
        title: data.title || 'No Title',
        thumbnailUrl: data.thumbnailUrl || 'https://placehold.co/120x90.png',
        channelTitle: data.channelTitle || 'Unknown Channel',
        publishedAt: data.publishedAt || new Date(0).toISOString(),
        descriptionSnippet: data.descriptionSnippet || '',
        matchedKeywords: data.matchedKeywords || [],
        dataAiHint: data.dataAiHint || 'youtube video',
        userId: data.userId || userId, 
        viewCount: data.viewCount || 0,
        likeCount: data.likeCount || 0,
        commentCount: data.commentCount || 0,
        sentiment: data.sentiment || 'unknown', // Ensure sentiment is included
      } as YouTubeMentionItem;
    });
    return mentions;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[youtube-video-service (getStoredYouTubeMentions)] Error fetching for user ${userId}: ${errorMessage}`, error);
    if (error instanceof Error && (error.message.includes(' benötigt einen Index') || error.message.includes('needs an index') || error.message.includes('requires an index'))) {
        console.error(`[SERVICE] Firestore index missing for '${mentionsPath}'. The simplified query requires an index on 'publishedAt' (descending). The original query required 'publishedAt' (desc) then 'fetchedAt' (desc). Check Firestore console for index creation link.`);
    }
    return [];
  }
}


