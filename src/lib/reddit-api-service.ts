
'use server';

import type { RedditPost, RedditSearchParams as ClientRedditSearchParams } from '@/types';
import { getApiKeys } from './api-key-service';
import { Sentiment } from 'sentiment';

const REDDIT_CLIENT_ID_SERVICE_NAME = "Reddit Client ID";
const REDDIT_CLIENT_SECRET_SERVICE_NAME = "Reddit Client Secret";
const REDDIT_USER_AGENT_SERVICE_NAME = "Reddit User Agent";

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

const sentimentAnalyzer = new Sentiment();

async function getRedditAccessToken(): Promise<string | null> {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const apiKeys = await getApiKeys();
  const clientIdEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_ID_SERVICE_NAME);
  const clientSecretEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_SECRET_SERVICE_NAME);

  if (!clientIdEntry || !clientSecretEntry) {
    console.error(`[Reddit API Service] Critical: '${REDDIT_CLIENT_ID_SERVICE_NAME}' or '${REDDIT_CLIENT_SECRET_SERVICE_NAME}' not found in API Management. Reddit functionality will be impaired.`);
    return null;
  }
  const clientId = clientIdEntry.keyValue;
  const clientSecret = clientSecretEntry.keyValue;

  try {
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret),
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); } catch (e) { errorData = { message: response.statusText, status: response.status }; }
      console.error('[Reddit API Service] Failed to obtain access token:', response.status, errorData);
      accessToken = null; tokenExpiry = null;
      return null;
    }

    const tokenData = await response.json();
    accessToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000;
    // console.log('[Reddit API Service] Successfully obtained new Reddit access token.');
    return accessToken;
  } catch (error) {
    console.error('[Reddit API Service] Exception fetching access token:', error);
    accessToken = null; tokenExpiry = null;
    return null;
  }
}

export type { ClientRedditSearchParams as RedditSearchParams };

interface RedditApiItemData {
  id: string;
  name: string;
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
  subreddit_name_prefixed?: string;
  subreddit?: string;
  title?: string;
  link_title?: string; // For comments, this is the parent post's title
  num_comments?: number;
  link_flair_text?: string | null;
  selftext?: string;
  body?: string;
  url?: string;
  over_18?: boolean;
}

interface RedditApiChild {
  kind: 't1' | 't3' | 'more';
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

export async function searchReddit(
  params: ClientRedditSearchParams
): Promise<{ data: RedditPost[] | null; error?: string; nextAfter?: string | null }> {
  const token = await getRedditAccessToken();
  if (!token) {
    return { data: null, error: "Failed to authenticate with Reddit. Check API logs and ensure Client ID & Secret are correctly set in API Management.", nextAfter: null };
  }

  const apiKeys = await getApiKeys();
  const userAgentEntry = apiKeys.find(k => k.serviceName === REDDIT_USER_AGENT_SERVICE_NAME);
  const userAgent = userAgentEntry ? userAgentEntry.keyValue : "InsightStreamApp/1.0 (FallbackUserAgent)";
   if (!userAgentEntry) {
      console.warn(`[Reddit API Service] Warning: '${REDDIT_USER_AGENT_SERVICE_NAME}' not found in API Management. Using fallback User-Agent.`);
  }

  const { q, sort = 'new', t = 'all', subreddit, limit = 25, after } = params; // Default limit reduced for more frequent pagination if needed.
  
  let apiUrl = `https://oauth.reddit.com/`;
  if (subreddit) {
    const cleanSubreddit = subreddit.startsWith('r/') ? subreddit.substring(2) : subreddit;
    apiUrl += `r/${cleanSubreddit}/`;
  }
  apiUrl += `search.json?q=${encodeURIComponent(q)}&limit=${limit}&sort=${sort}&t=${t}&type=t3,t1&show=all&restrict_sr=${!!subreddit}&include_over_18=on`;
  if (after) {
    apiUrl += `&after=${after}`;
  }

  console.log(`[Reddit API Service] Querying Reddit: ${apiUrl.replace(q, `'${q}'`)}`);

  try {
    const response = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[Reddit API Service] Error fetching from Reddit (${response.status}): ${errorText}`);
      return { data: null, error: `Reddit API Error (${response.status}). Check server logs.`, nextAfter: null };
    }

    const rawResponseData: RedditApiResponse = await response.json();
    const rawItems = rawResponseData.data?.children || [];
    
    const rawPostCount = rawItems.filter(child => child.kind === 't3').length;
    const rawCommentCount = rawItems.filter(child => child.kind === 't1').length;
    const rawOtherCount = rawItems.length - rawPostCount - rawCommentCount;
    console.log(`[Reddit API Service] Received ${rawItems.length} raw items from API. (Posts: ${rawPostCount}, Comments: ${rawCommentCount}, Others: ${rawOtherCount})`);
    // if (rawItems.length > 0) {
    //   console.log(`[Reddit API Service] Item kinds received from API: ${rawItems.map(child => child.kind).join(', ')}`);
    // }


    const mappedItems: RedditPost[] = [];
    for (const child of rawItems) {
      const data = child.data;
      if (child.kind === 't3') { // Post
        const postTextToAnalyze = `${data.title || ''} ${data.selftext || ''}`;
        const postSentimentResult = sentimentAnalyzer.analyze(postTextToAnalyze);
        let postSentiment: RedditPost['sentiment'] = 'neutral';
        if (postSentimentResult.score > 0) postSentiment = 'positive';
        else if (postSentimentResult.score < 0) postSentiment = 'negative';

        mappedItems.push({
          id: data.name, // Fullname (t3_xxxx)
          title: data.title || 'No Title',
          content: data.selftext || '',
          subreddit: data.subreddit_name_prefixed || `r/${data.subreddit}` || 'N/A',
          author: data.author || '[deleted]',
          timestamp: new Date((data.created_utc || 0) * 1000).toISOString(),
          score: data.score || 0,
          numComments: data.num_comments || 0,
          url: (data.url && data.url.startsWith('http')) ? data.url : `https://www.reddit.com${data.permalink}`,
          flair: data.link_flair_text || undefined,
          sentiment: postSentiment,
          type: 'Post',
        });
      } else if (child.kind === 't1') { // Comment
        const commentTextToAnalyze = `${data.link_title || ''} ${data.body || ''}`;
        const commentSentimentResult = sentimentAnalyzer.analyze(commentTextToAnalyze);
        let commentSentiment: RedditPost['sentiment'] = 'neutral';
        if (commentSentimentResult.score > 0) commentSentiment = 'positive';
        else if (commentSentimentResult.score < 0) commentSentiment = 'negative';
        
        mappedItems.push({
          id: data.name, // Fullname (t1_xxxx)
          title: data.link_title || 'Comment (No Parent Title)', // Parent post's title
          content: data.body || '',
          subreddit: data.subreddit_name_prefixed || `r/${data.subreddit}` || 'N/A',
          author: data.author || '[deleted]',
          timestamp: new Date((data.created_utc || 0) * 1000).toISOString(),
          score: data.score || 0,
          numComments: 0, // Comments don't have numComments in this context (it's for their own replies)
          url: `https://www.reddit.com${data.permalink}`,
          flair: undefined,
          sentiment: commentSentiment,
          type: 'Comment',
        });
      }
    }
    const postsBeforeFilter = mappedItems.filter(item => item.type === 'Post').length;
    const commentsBeforeFilter = mappedItems.filter(item => item.type === 'Comment').length;
    console.log(`[Reddit API Service] Mapped ${mappedItems.length} items before date filtering. (Posts: ${postsBeforeFilter}, Comments: ${commentsBeforeFilter})`);

    const CUTOFF_DATE_STRING = '2025-06-01T00:00:00.000Z';
    const cutoffTimestamp = new Date(CUTOFF_DATE_STRING).getTime();
    console.log(`[Reddit API Service] Date filter active: Items must be on or after ${CUTOFF_DATE_STRING} (Cutoff Timestamp: ${cutoffTimestamp})`);

    const itemsAfterDateFilter = mappedItems.filter((item, index) => {
      const itemDate = new Date(item.timestamp); // item.timestamp is already an ISO string
      const itemNumericTimestamp = itemDate.getTime();
      const isKept = itemNumericTimestamp >= cutoffTimestamp;
      
      // Log details for the first 3 items being processed, and any of the first 10 that are discarded
      if (index < 3 || (index < 10 && !isKept)) {
        console.log(`[Reddit API Filter Detail] Item ID: ${item.id}, Type: ${item.type}, Item Date: ${item.timestamp} (Numeric: ${itemNumericTimestamp}), Cutoff Timestamp: ${cutoffTimestamp}, Kept: ${isKept}`);
      }
      return isKept;
    });

    const postsAfterFilter = itemsAfterDateFilter.filter(item => item.type === 'Post').length;
    const commentsAfterFilter = itemsAfterDateFilter.filter(item => item.type === 'Comment').length;
    console.log(`[Reddit API Service] After date filtering (>= ${CUTOFF_DATE_STRING}), ${itemsAfterDateFilter.length} items remain. (Posts: ${postsAfterFilter}, Comments: ${commentsAfterFilter})`);

    const finalSortedData = itemsAfterDateFilter.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const nextAfterCursor = rawResponseData.data?.after || null;
    // console.log(`[Reddit API Service] Returning ${finalSortedData.length} items. Next cursor: ${nextAfterCursor}`);

    return { data: finalSortedData, error: undefined, nextAfter: nextAfterCursor };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error.';
    console.error(`[Reddit API Service] Exception during Reddit search or processing:`, error);
    return { data: null, error: `Network or processing error: ${errorMessage}`, nextAfter: null };
  }
}
