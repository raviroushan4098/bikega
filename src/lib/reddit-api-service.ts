
'use server';

import type { RedditPost } from '@/types';
import { getApiKeys } from './api-key-service';

// Define service names as constants for consistency
const REDDIT_CLIENT_ID_SERVICE_NAME = "Reddit Client ID";
const REDDIT_CLIENT_SECRET_SERVICE_NAME = "Reddit Client Secret";
const REDDIT_USER_AGENT_SERVICE_NAME = "Reddit User Agent";

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

async function getRedditAccessToken(): Promise<string | null> {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const apiKeys = await getApiKeys();
  const clientIdEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_ID_SERVICE_NAME);
  const clientSecretEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_SECRET_SERVICE_NAME);

  if (!clientIdEntry || !clientSecretEntry) {
    console.error(`[Reddit API Service] Critical: '${REDDIT_CLIENT_ID_SERVICE_NAME}' or '${REDDIT_CLIENT_SECRET_SERVICE_NAME}' not found in API Management. Please add them.`);
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
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText, status: response.status };
      }
      console.error('[Reddit API Service] Failed to obtain access token:', response.status, errorData);
      accessToken = null;
      tokenExpiry = null;
      return null;
    }

    const tokenData = await response.json();
    accessToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000; // Refresh 5 mins before expiry
    console.log("[Reddit API Service] New Reddit access token obtained.");
    return accessToken;
  } catch (error) {
    console.error('[Reddit API Service] Error fetching access token:', error);
    accessToken = null;
    tokenExpiry = null;
    return null;
  }
}

export interface RedditSearchParams {
  q: string;
  limit?: number;
  sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
  t?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  subreddit?: string;
  after?: string; 
}

interface RedditApiItemData {
  id: string;
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
  subreddit_name_prefixed: string;
  title?: string;
  num_comments?: number;
  link_flair_text?: string | null;
  selftext?: string;
  url?: string; 
  body?: string; 
  link_title?: string; 
  link_url?: string;
  parent_id?: string; 
}

interface RedditApiChild {
  kind: string; 
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
  params: RedditSearchParams
): Promise<{ data: RedditPost[] | null; error?: string; nextAfter?: string | null }> {
  const token = await getRedditAccessToken();
  if (!token) {
    return { data: null, error: "Failed to authenticate with Reddit. Check API logs and ensure Client ID & Secret are correctly set in API Management.", nextAfter: null };
  }

  const apiKeys = await getApiKeys();
  const userAgentEntry = apiKeys.find(k => k.serviceName === REDDIT_USER_AGENT_SERVICE_NAME);
  
  const userAgent = userAgentEntry ? userAgentEntry.keyValue : "InsightStreamApp/1.0 (FallbackUserAgent)";
  if (!userAgentEntry) {
      console.warn(`[Reddit API Service] Warning: '${REDDIT_USER_AGENT_SERVICE_NAME}' not found in API Management. Using fallback. Please add it for compliance with Reddit API terms.`);
  }

  const { q, limit = 100, sort = 'new', t = 'all', subreddit, after } = params;
    
  let combinedSearchUrl = `https://oauth.reddit.com/`;
  if (subreddit) {
      // Ensure 'r/' prefix is handled correctly, remove if present before adding
      const cleanSubreddit = subreddit.startsWith('r/') ? subreddit.substring(2) : subreddit;
      combinedSearchUrl += `r/${cleanSubreddit}/`;
  }
  combinedSearchUrl += `search.json?q=${encodeURIComponent(q)}&limit=${limit}&sort=${sort}&t=${t}&type=link,comment&show=all&include_over_18=on`;
  
  if (after) {
      combinedSearchUrl += `&after=${after}`;
  }
  // restrict_sr=true should only be used when searching within a specific subreddit context (i.e., when params.subreddit is provided)
  if (subreddit) {
      combinedSearchUrl += `&restrict_sr=true`;
  }
  
  console.log(`[Reddit API Service] Fetching combined posts/comments via OAuth (limit ${limit}${after ? ', after ' + after : ''}): ${combinedSearchUrl.replace(q,encodeURIComponent(q))}`);

  try {
    const response = await fetch(combinedSearchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[Reddit API Service] OAuth API Error for combined search (${response.status}): ${errorText}`);
      return { data: [], nextAfter: null, error: `Reddit API Error: ${response.status}. Details: ${errorText.substring(0, 200)}` };
    }

    const rawData: RedditApiResponse = await response.json();

    if (!rawData || !rawData.data || !rawData.data.children) {
        console.error(`[Reddit API Service] Unexpected OAuth API response structure for combined search:`, rawData);
        return { data: [], nextAfter: null, error: "Invalid API response structure from Reddit."};
    }

    const combinedResults: RedditPost[] = rawData.data.children.map(child => {
      if (child.kind === 't3') { // Post
        return {
          id: child.data.id,
          title: child.data.title || 'No Title',
          content: child.data.selftext || '',
          subreddit: child.data.subreddit_name_prefixed,
          author: child.data.author,
          timestamp: new Date(child.data.created_utc * 1000).toISOString(),
          score: child.data.score,
          numComments: child.data.num_comments || 0,
          url: child.data.url ? (child.data.url.startsWith('http') ? child.data.url : `https://www.reddit.com${child.data.permalink}`) : `https://www.reddit.com${child.data.permalink}`,
          flair: child.data.link_flair_text || undefined,
          sentiment: 'unknown',
          type: 'Post',
        } as RedditPost;
      } else if (child.kind === 't1') { // Comment
        return {
          id: child.data.id,
          title: child.data.link_title || 'Comment on Post', // Title of the post the comment is on
          content: child.data.body || '', // The comment text itself
          subreddit: child.data.subreddit_name_prefixed,
          author: child.data.author,
          timestamp: new Date(child.data.created_utc * 1000).toISOString(),
          score: child.data.score,
          numComments: 0, // Comments don't have their own numComments in this context
          url: `https://www.reddit.com${child.data.permalink}`, // Permalink to the comment
          flair: undefined,
          sentiment: 'unknown', 
          type: 'Comment',
        } as RedditPost;
      }
      return null;
    }).filter(item => item !== null) as RedditPost[];
    
    // The API should already sort by 'new' if specified, but an additional client sort can be a fallback.
    // combinedResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const nextCursor = rawData.data.after;
    console.log(`[Reddit API Service] Fetched ${combinedResults.length} items. Next cursor: ${nextCursor}`);
    if (combinedResults.length > 0) {
        const commentCount = combinedResults.filter(r => r.type === 'Comment').length;
        console.log(`[Reddit API Service] Of these, ${commentCount} are comments.`);
    }


    return { data: combinedResults, nextAfter: nextCursor };

  } catch (error) {
    console.error('[Reddit API Service] Error in combined searchReddit:', error);
    if (error instanceof Error) {
      return { data: null, error: `Network or parsing error: ${error.message}`, nextAfter: null };
    }
    return { data: null, error: 'An unknown error occurred while fetching from Reddit OAuth API.', nextAfter: null };
  }
}
