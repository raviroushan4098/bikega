
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
    tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000;
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
  after?: string; // Added for pagination
}

// Interface for raw Reddit API response item data (can be post or comment)
interface RedditApiItemData {
  // Common fields
  id: string;
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
  subreddit_name_prefixed: string;

  // Post specific (kind: t3)
  title?: string;
  num_comments?: number;
  link_flair_text?: string | null;
  selftext?: string; // For self-posts
  url?: string; // URL of the post itself or external link

  // Comment specific (kind: t1)
  body?: string; // Comment text
  link_title?: string; // Title of the post the comment is on
  link_url?: string; // URL of the post the comment is on
  parent_id?: string; // ID of parent (comment or post)
}

interface RedditApiChild {
  kind: string; // "t3" for post (link), "t1" for comment
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

// Internal function to fetch a specific type (posts or comments) with pagination support
async function fetchRedditDataByType(
  token: string,
  userAgent: string,
  params: RedditSearchParams,
  searchType: 'link' | 'comment'
): Promise<{ items: RedditPost[]; nextAfter: string | null }> {
  const { q, limit = 25, sort = 'relevance', t = 'all', subreddit, after } = params;

  let searchUrl = `https://oauth.reddit.com/`;
  if (subreddit) {
    searchUrl += `${subreddit.startsWith('r/') ? subreddit : 'r/' + subreddit}/`;
  }
  searchUrl += `search.json?q=${encodeURIComponent(q)}&limit=${limit}&sort=${sort}&t=${t}&type=${searchType}&show=all`;
  
  if (after) {
    searchUrl += `&after=${after}`;
  }
  if (subreddit && searchType === 'link') {
     searchUrl += `&restrict_sr=true`;
  }


  console.log(`[Reddit API Service] Fetching ${searchType}s via OAuth (limit ${limit}${after ? ', after ' + after : ''}): ${searchUrl.replace(q,encodeURIComponent(q))}`);

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Reddit API Service] OAuth API Error for ${searchType}s (${response.status}): ${errorText}`);
      return { items: [], nextAfter: null };
    }

    const rawData: RedditApiResponse = await response.json();

    if (!rawData || !rawData.data || !rawData.data.children) {
        console.error(`[Reddit API Service] Unexpected OAuth API response structure for ${searchType}s:`, rawData);
        return { items: [], nextAfter: null };
    }
    
    const items = rawData.data.children.map(child => {
      if (searchType === 'link' && child.kind === 't3') { // Post
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
          sentiment: 'unknown', // Placeholder, can be updated later
          type: 'Post',
        } as RedditPost;
      } else if (searchType === 'comment' && child.kind === 't1') { // Comment
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
          sentiment: 'unknown', // Placeholder
          type: 'Comment',
        } as RedditPost;
      }
      return null;
    }).filter(item => item !== null) as RedditPost[];
    
    return { items, nextAfter: rawData.data.after };

  } catch (error) {
    console.error(`[Reddit API Service] OAuth Fetch Error for ${searchType}s:`, error);
    return { items: [], nextAfter: null };
  }
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
      console.warn(`[Reddit API Service] '${REDDIT_USER_AGENT_SERVICE_NAME}' not found in API Management. Using fallback. Please add it.`);
  }

  const { limit = 100, after } = params; // Default total limit for combined results
  // If 'after' is provided, we're paginating. Fetching both types might become complex with independent 'after' cursors.
  // For simplicity in this step, if 'after' is used, we might only fetch one type or alternate.
  // Or, we can fetch both and rely on the client to manage displaying them.
  // For now, let's keep fetching both and see. Reddit's 'after' for a search query might apply globally.

  const perTypeLimit = Math.ceil(limit / 2);

  try {
    // Pass the 'after' cursor to both calls. Reddit's search 'after' usually applies to the whole query.
    const postsParams = { ...params, limit: perTypeLimit, after };
    const commentsParams = { ...params, limit: perTypeLimit, after };

    // Fetch posts and comments.
    // Note: If fetching both types and paginating, the 'nextAfter' cursor management can be tricky.
    // Reddit's 'after' on search applies to the *entire result set of that search query*.
    // So, if we search for posts AND comments with an 'after' cursor, it continues from that point.
    
    // For simplicity, we'll just use the 'after' from the primary search call (e.g., posts or combined if API supported)
    // We'll prioritize fetching posts with pagination and then comments.
    // Or, better: make one call for combined types if Reddit search supports it well.
    // Reddit API's `type` param can be `link,comment`.
    
    let combinedSearchUrl = `https://oauth.reddit.com/`;
    if (params.subreddit) {
        combinedSearchUrl += `${params.subreddit.startsWith('r/') ? params.subreddit : 'r/' + params.subreddit}/`;
    }
    combinedSearchUrl += `search.json?q=${encodeURIComponent(params.q)}&limit=${limit}&sort=${params.sort || 'new'}&t=${params.t || 'all'}&type=link,comment&show=all`;
    if (after) {
        combinedSearchUrl += `&after=${after}`;
    }
    if (params.subreddit) {
        combinedSearchUrl += `&restrict_sr=true`;
    }
    
    console.log(`[Reddit API Service] Fetching combined posts/comments via OAuth (limit ${limit}${after ? ', after ' + after : ''}): ${combinedSearchUrl.replace(params.q,encodeURIComponent(params.q))}`);

    const response = await fetch(combinedSearchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Reddit API Service] OAuth API Error for combined search (${response.status}): ${errorText}`);
      return { data: [], nextAfter: null, error: `Reddit API Error: ${response.status}` };
    }

    const rawData: RedditApiResponse = await response.json();

    if (!rawData || !rawData.data || !rawData.data.children) {
        console.error(`[Reddit API Service] Unexpected OAuth API response structure for combined search:`, rawData);
        return { data: [], nextAfter: null, error: "Invalid API response structure."};
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
          title: child.data.link_title || 'Comment on Post',
          content: child.data.body || '',
          subreddit: child.data.subreddit_name_prefixed,
          author: child.data.author,
          timestamp: new Date(child.data.created_utc * 1000).toISOString(),
          score: child.data.score,
          numComments: 0,
          url: `https://www.reddit.com${child.data.permalink}`,
          flair: undefined,
          sentiment: 'unknown',
          type: 'Comment',
        } as RedditPost;
      }
      return null;
    }).filter(item => item !== null) as RedditPost[];

    // Sort by timestamp descending (newest first) as API might mix them
    combinedResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // The 'nextAfter' from the Reddit API response is the cursor for the next page of this combined search
    const nextCursor = rawData.data.after;

    return { data: combinedResults, nextAfter: nextCursor };

  } catch (error) {
    console.error('[Reddit API Service] Error in combined searchReddit:', error);
    if (error instanceof Error) {
      return { data: null, error: `Network or parsing error: ${error.message}`, nextAfter: null };
    }
    return { data: null, error: 'An unknown error occurred while fetching from Reddit OAuth API.', nextAfter: null };
  }
}
