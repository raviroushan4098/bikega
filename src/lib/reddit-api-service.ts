
'use server';

import type { RedditPost, RedditSearchParams as ClientRedditSearchParams } from '@/types';
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
    // console.log("[Reddit API Service] New Reddit access token obtained.");
    return accessToken;
  } catch (error) {
    console.error('[Reddit API Service] Error fetching access token:', error);
    accessToken = null;
    tokenExpiry = null;
    return null;
  }
}

// Re-exporting the interface from types.ts for client-side use if needed,
// but internal service might use a more specific one if parameters diverge.
export type { ClientRedditSearchParams as RedditSearchParams };


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
  kind: 't1' | 't3'; // t1 for comment, t3 for link/post
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

// Helper function to fetch and map data for a specific type (post or comment)
async function fetchAndMapRedditData(
  type: 'link' | 'comment',
  searchParams: ClientRedditSearchParams,
  requestLimit: number,
  token: string,
  userAgent: string,
  specificAfterCursor?: string | null
): Promise<{ items: RedditPost[]; nextCursor: string | null; error?: string }> {
  const { q, sort = 'new', t = 'all', subreddit } = searchParams;

  let apiUrl = `https://oauth.reddit.com/`;
  if (subreddit) {
    const cleanSubreddit = subreddit.startsWith('r/') ? subreddit.substring(2) : subreddit;
    apiUrl += `r/${cleanSubreddit}/`;
  }
  apiUrl += `search.json?q=${encodeURIComponent(q)}&limit=${requestLimit}&sort=${sort}&t=${t}&type=${type}&show=all&include_over_18=on&restrict_sr=${!!subreddit}`;
  
  if (specificAfterCursor) {
    apiUrl += `&after=${specificAfterCursor}`;
  }

  // console.log(`[Reddit API Service] Fetching ${type}s (limit ${requestLimit}${specificAfterCursor ? ', after ' + specificAfterCursor : ''}): ${apiUrl.replace(q,encodeURIComponent(q))}`);

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[Reddit API Service] OAuth API Error for ${type} search (${response.status}): ${errorText}`);
      return { items: [], nextCursor: null, error: `Reddit API Error for ${type}s (${response.status}).` };
    }

    const rawData: RedditApiResponse = await response.json();

    if (!rawData || !rawData.data || !rawData.data.children) {
        console.error(`[Reddit API Service] Unexpected OAuth API response structure for ${type} search:`, rawData);
        return { items: [], nextCursor: null, error: `Invalid API response for ${type}s.`};
    }
    
    const items: RedditPost[] = rawData.data.children
      .map(child => {
        const data = child.data;
        if (type === 'link' && child.kind === 't3') { // Processing a Post
          return {
            id: data.id,
            title: data.title || 'No Title',
            content: data.selftext || '',
            subreddit: data.subreddit_name_prefixed,
            author: data.author,
            timestamp: new Date(data.created_utc * 1000).toISOString(),
            score: data.score,
            numComments: data.num_comments || 0,
            url: data.url && data.url.startsWith('http') ? data.url : `https://www.reddit.com${data.permalink}`,
            flair: data.link_flair_text || undefined,
            sentiment: 'unknown', // Placeholder
            type: 'Post',
          } as RedditPost;
        } else if (type === 'comment' && child.kind === 't1') { // Processing a Comment
          return {
            id: data.id,
            title: data.link_title || 'Comment on Post', 
            content: data.body || '', 
            subreddit: data.subreddit_name_prefixed,
            author: data.author,
            timestamp: new Date(data.created_utc * 1000).toISOString(),
            score: data.score,
            numComments: 0, 
            url: `https://www.reddit.com${data.permalink}`,
            flair: undefined,
            sentiment: 'unknown', // Placeholder
            type: 'Comment',
          } as RedditPost;
        }
        return null; // Should not happen if type param matches child.kind
      })
      .filter(item => item !== null) as RedditPost[];

    return { items, nextCursor: rawData.data.after, error: undefined };
  } catch (error) {
    console.error(`[Reddit API Service] Error in fetchAndMapRedditData for ${type}s:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error.';
    return { items: [], nextCursor: null, error: `Network or parsing error for ${type}s: ${errorMessage}` };
  }
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
      console.warn(`[Reddit API Service] Warning: '${REDDIT_USER_AGENT_SERVICE_NAME}' not found. Using fallback.`);
  }

  const totalLimit = params.limit || 100;
  // Ensure at least 1 if totalLimit is 1, otherwise split.
  const postLimit = totalLimit === 1 ? 1 : Math.ceil(totalLimit / 2); 
  const commentLimit = totalLimit === 1 ? 0 : Math.floor(totalLimit / 2);
  
  // The single 'after' from params is used for both queries in this simplified pagination.
  // A more robust pagination for mixed content might track separate cursors.
  const commonAfterCursor = params.after || null; 

  let allItems: RedditPost[] = [];
  let postsNextCursor: string | null = null;
  let commentsNextCursor: string | null = null;
  let anyError: string | undefined = undefined;

  if (postLimit > 0) {
    const postResult = await fetchAndMapRedditData('link', params, postLimit, token, userAgent, commonAfterCursor);
    if (postResult.error) anyError = (anyError ? anyError + "; " : "") + `Posts: ${postResult.error}`;
    if (postResult.items) allItems = allItems.concat(postResult.items);
    postsNextCursor = postResult.nextCursor;
  }

  if (commentLimit > 0) {
    // For comments, if commonAfterCursor was used for posts, it might not be ideal.
    // However, Reddit's /search 'after' is opaque and might work across types if the query is broad.
    // Or, for comments, we might often want the newest, regardless of post cursor.
    // For now, using commonAfterCursor for both for simplicity.
    const commentResult = await fetchAndMapRedditData('comment', params, commentLimit, token, userAgent, commonAfterCursor);
    if (commentResult.error) anyError = (anyError ? anyError + "; " : "") + `Comments: ${commentResult.error}`;
    if (commentResult.items) allItems = allItems.concat(commentResult.items);
    commentsNextCursor = commentResult.nextCursor;
  }

  if (anyError && allItems.length === 0) {
    return { data: null, error: anyError, nextAfter: null };
  }
  
  allItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  const finalData = allItems.slice(0, totalLimit);
  
  // Simplified next cursor: if either type has a next cursor, we suggest more data *might* be loadable.
  // The frontend will pass this back as 'params.after' for the next batch.
  // This isn't perfect for balancing post/comment pages but is a step towards mixed content pagination.
  const overallNextAfter = postsNextCursor || commentsNextCursor; 

  const postCountInBatch = finalData.filter(p => p.type === 'Post').length;
  const commentCountInBatch = finalData.filter(p => p.type === 'Comment').length;
  console.log(`[Reddit API Service] searchReddit returned: ${postCountInBatch} posts, ${commentCountInBatch} comments. Total: ${finalData.length}. Next cursor for combined (simplified): ${overallNextAfter}`);

  return { data: finalData, error: anyError, nextAfter: overallNextAfter };
}
