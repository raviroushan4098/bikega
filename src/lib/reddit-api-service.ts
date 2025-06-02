
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
    // console.log("[Reddit API Service] Using cached Reddit access token.");
    return accessToken;
  }

  const apiKeys = await getApiKeys();
  const clientIdEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_ID_SERVICE_NAME);
  const clientSecretEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_SECRET_SERVICE_NAME);

  if (!clientIdEntry || !clientSecretEntry) {
    console.error(`[Reddit API Service] '${REDDIT_CLIENT_ID_SERVICE_NAME}' or '${REDDIT_CLIENT_SECRET_SERVICE_NAME}' not found in API Management. Please add them.`);
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
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[Reddit API Service] Failed to obtain access token:', response.status, errorData);
      accessToken = null;
      tokenExpiry = null;
      return null;
    }

    const tokenData = await response.json();
    accessToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000; // expires_in is in seconds, set expiry 5 mins earlier
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
}

interface RedditOAuthApiResponseChildData {
  title: string;
  subreddit_name_prefixed: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  permalink: string;
  link_flair_text?: string | null;
  id: string;
  selftext: string;
  url: string; 
  thumbnail?: string;
  is_self?: boolean;
  url_overridden_by_dest?: string;
}

interface RedditOAuthApiResponseChild {
  kind: string;
  data: RedditOAuthApiResponseChildData;
}

interface RedditOAuthApiResponseData {
  after: string | null;
  dist: number;
  children: RedditOAuthApiResponseChild[];
  before: string | null;
}

interface RedditOAuthApiResponse {
  kind: string;
  data: RedditOAuthApiResponseData;
}

export async function searchReddit(
  params: RedditSearchParams
): Promise<{ data: RedditPost[] | null; error?: string }> {
  const token = await getRedditAccessToken();
  if (!token) {
    return { data: null, error: "Failed to authenticate with Reddit. Check API logs and ensure Client ID & Secret are correctly set in API Management." };
  }

  const apiKeys = await getApiKeys();
  const userAgentEntry = apiKeys.find(k => k.serviceName === REDDIT_USER_AGENT_SERVICE_NAME);
  
  const userAgent = userAgentEntry ? userAgentEntry.keyValue : "InsightStreamApp/1.0 (FallbackUserAgent)";
  if (!userAgentEntry) {
      console.warn(`[Reddit API Service] '${REDDIT_USER_AGENT_SERVICE_NAME}' not found in API Management. Using fallback. Please add it.`);
  }


  const { q, limit = 25, sort = 'relevance', t = 'all', subreddit } = params;

  let searchUrl = `https://oauth.reddit.com/`;
  if (subreddit) {
    searchUrl += `${subreddit.startsWith('r/') ? subreddit : 'r/' + subreddit}/`;
  }
  searchUrl += `search.json?q=${encodeURIComponent(q)}&limit=${limit}&sort=${sort}&t=${t}&show=all`; // show=all includes NSFW if any
  
  if (subreddit) {
     searchUrl += `&restrict_sr=true`;
  }

  console.log(`[Reddit API Service] Fetching via OAuth: ${searchUrl.replace(q,encodeURIComponent(q))}`); // Log with encoded query for safety

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Reddit API Service] OAuth API Error (${response.status}): ${errorText}`);
      try {
        const errorJson = JSON.parse(errorText);
        return { data: null, error: `Reddit API Error (${response.status}): ${errorJson.message || response.statusText}` };
      } catch {
        return { data: null, error: `Reddit API Error (${response.status}): ${response.statusText}` };
      }
    }

    const rawData: RedditOAuthApiResponse = await response.json();

    if (!rawData || !rawData.data || !rawData.data.children) {
        console.error("[Reddit API Service] Unexpected OAuth API response structure:", rawData);
        return { data: null, error: "Unexpected response structure from Reddit OAuth API." };
    }
    
    const posts: RedditPost[] = rawData.data.children.map(child => ({
      id: child.data.id,
      title: child.data.title,
      subreddit: child.data.subreddit_name_prefixed,
      author: child.data.author,
      timestamp: new Date(child.data.created_utc * 1000).toISOString(),
      score: child.data.score,
      numComments: child.data.num_comments,
      url: `https://www.reddit.com${child.data.permalink}`,
      flair: child.data.link_flair_text || undefined,
      sentiment: 'unknown', // Placeholder sentiment
    }));

    return { data: posts };
  } catch (error) {
    console.error('[Reddit API Service] OAuth Fetch Error:', error);
    if (error instanceof Error) {
      return { data: null, error: `Network or parsing error: ${error.message}` };
    }
    return { data: null, error: 'An unknown error occurred while fetching from Reddit OAuth API.' };
  }
}
