
'use server';

import type { RedditPost, RedditSearchParams as ClientRedditSearchParams } from '@/types';
import { getApiKeys } from './api-key-service';
import Sentiment from 'sentiment';

const REDDIT_CLIENT_ID_SERVICE_NAME = "Reddit Client ID";
const REDDIT_CLIENT_SECRET_SERVICE_NAME = "Reddit Client Secret";
const REDDIT_USER_AGENT_SERVICE_NAME = "Reddit User Agent";

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

const sentimentAnalyzer = new Sentiment();

const CUTOFF_DATE_STRING = '2025-06-01T00:00:00.000Z';
const CUTOFF_TIMESTAMP = new Date(CUTOFF_DATE_STRING).getTime();

const COMMENTS_PER_POST_LIMIT = 10; // Max comments to fetch per post
const COMMENT_FETCH_DEPTH = 1; // Fetch only top-level comments

async function getRedditAccessToken(): Promise<string | null> {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const apiKeys = await getApiKeys();
  const clientIdEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_ID_SERVICE_NAME);
  const clientSecretEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_SECRET_SERVICE_NAME);

  if (!clientIdEntry || !clientSecretEntry) {
    console.error(`[Reddit API Service] Critical: '${REDDIT_CLIENT_ID_SERVICE_NAME}' or '${REDDIT_CLIENT_SECRET_SERVICE_NAME}' not found. Reddit functionality impaired.`);
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
    tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000; // -300 for buffer
    return accessToken;
  } catch (error) {
    console.error('[Reddit API Service] Exception fetching access token:', error);
    accessToken = null; tokenExpiry = null;
    return null;
  }
}

export type { ClientRedditSearchParams as RedditSearchParams };

interface RedditApiItemData {
  id: string; // Just the ID part, e.g., "xxxxxx"
  name: string; // Fullname (e.g., t3_xxxxxx or t1_xxxxxx)
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
  subreddit_name_prefixed?: string;
  subreddit?: string;
  title?: string; // For posts (t3)
  link_title?: string; // For comments (t1 on a post page)
  num_comments?: number; // For posts (t3)
  link_flair_text?: string | null;
  selftext?: string; // For posts (t3)
  body?: string; // For comments (t1)
  url?: string; // For posts (t3)
  over_18?: boolean;
  // For comments from /comments/POST_ID.json
  replies?: RedditApiResponse | string; // Can be empty string if no replies, or another Listing
  body_html?: string;
}

interface RedditApiChild {
  kind: 't1' | 't3' | 'more' | 'Listing';
  data: RedditApiItemData | RedditApiResponseData; // 'data' can be item or another listing for replies
}

interface RedditApiResponseData {
  after: string | null;
  dist: number;
  children: RedditApiChild[];
  before: string | null;
  modhash?: string; // Present in comment listings
}

interface RedditApiResponse {
  kind: string; // "Listing"
  data: RedditApiResponseData;
}

// Type for the response from /api/comments/ARTICLE_ID.json
// It's an array: [Listing_of_Post_Details, Listing_of_Comments]
type RedditCommentsApiResponse = [RedditApiResponse, RedditApiResponse];


async function fetchCommentsForPost(
  postFullname: string,
  postTitle: string,
  postSubredditPrefixed: string,
  token: string,
  userAgent: string
): Promise<RedditPost[]> {
  const postId = postFullname.startsWith('t3_') ? postFullname.substring(3) : postFullname;
  if (!postId) {
    console.warn(`[Reddit API Service] Invalid post fullname for fetching comments: ${postFullname}`);
    return [];
  }

  const commentsUrl = `https://oauth.reddit.com/comments/${postId}.json?sort=new&limit=${COMMENTS_PER_POST_LIMIT}&depth=${COMMENT_FETCH_DEPTH}&show_more=false&show_edits=false`;
  console.log(`[Reddit API Service] Fetching comments for post ${postId} (limit ${COMMENTS_PER_POST_LIMIT}, depth ${COMMENT_FETCH_DEPTH}): ${commentsUrl}`);

  try {
    const response = await fetch(commentsUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[Reddit API Service] Error fetching comments for post ${postId} (${response.status}): ${errorText}`);
      return [];
    }

    const responseData: RedditCommentsApiResponse = await response.json();
    if (!responseData || !Array.isArray(responseData) || responseData.length < 2) {
        console.error(`[Reddit API Service] Unexpected response structure for comments of post ${postId}.`);
        return [];
    }
    
    const commentsListing = responseData[1]; // Second element is the comments listing
    const rawCommentItems = commentsListing?.data?.children || [];
    
    console.log(`[Reddit API Service] Received ${rawCommentItems.length} raw comment items for post ${postId}. Kinds: ${rawCommentItems.map(c => c.kind).join(', ')}`);

    const mappedComments: RedditPost[] = [];
    for (const child of rawCommentItems) {
      if (child.kind === 't1' && child.data && typeof child.data === 'object' && 'body' in child.data) {
        const commentData = child.data as RedditApiItemData;
        const sentimentResult = sentimentAnalyzer.analyze(commentData.body || '');
        let sentiment: RedditPost['sentiment'] = 'neutral';
        if (sentimentResult.score > 0.5) sentiment = 'positive';
        else if (sentimentResult.score < -0.5) sentiment = 'negative';

        mappedComments.push({
          id: commentData.name, // Fullname, e.g., t1_xxxxxx
          title: postTitle, // Parent post's title
          content: commentData.body || '',
          subreddit: postSubredditPrefixed, // Parent post's subreddit
          author: commentData.author || '[deleted]',
          timestamp: new Date((commentData.created_utc || 0) * 1000).toISOString(),
          score: commentData.score || 0,
          numComments: 0, // This is a comment itself
          url: `https://www.reddit.com${commentData.permalink}`,
          flair: undefined,
          sentiment: sentiment,
          type: 'Comment',
        });
      }
    }
    console.log(`[Reddit API Service] Mapped ${mappedComments.length} comments for post ${postId}.`);
    return mappedComments;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error.';
    console.error(`[Reddit API Service] Exception fetching/processing comments for post ${postId}:`, error);
    return [];
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
      console.warn(`[Reddit API Service] Warning: '${REDDIT_USER_AGENT_SERVICE_NAME}' not found in API Management. Using fallback User-Agent.`);
  }

  const { q, sort = 'new', t = 'all', subreddit, limit = 25, after } = params;
  const postsToFetchLimit = limit; // `limit` from params now controls number of posts

  let postSearchUrl = `https://oauth.reddit.com/`;
  if (subreddit) {
    const cleanSubreddit = subreddit.startsWith('r/') ? subreddit.substring(2) : subreddit;
    postSearchUrl += `r/${cleanSubreddit}/`;
  }
  postSearchUrl += `search.json?q=${encodeURIComponent(q)}&limit=${postsToFetchLimit}&sort=${sort}&t=${t}&type=t3&restrict_sr=${!!subreddit}&include_over_18=on`;
  if (after) {
    postSearchUrl += `&after=${after}`;
  }

  console.log(`[Reddit API Service] Phase 1: Fetching ${postsToFetchLimit} POSTS using URL: ${postSearchUrl.replace(q, `'${q}'`)}`);

  try {
    const postResponse = await fetch(postSearchUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text().catch(() => `Status: ${postResponse.status}`);
      console.error(`[Reddit API Service] Error fetching posts from Reddit (${postResponse.status}): ${errorText}`);
      return { data: null, error: `Reddit API Error for posts (${postResponse.status}). Check server logs.`, nextAfter: null };
    }

    const rawPostResponseData: RedditApiResponse = await postResponse.json();
    const rawPostItems = rawPostResponseData.data?.children || [];
    console.log(`[Reddit API Service] Received ${rawPostItems.length} raw post items from API. Kinds: ${rawPostItems.map(child => child.kind).join(', ')}`);

    const allFetchedItems: RedditPost[] = [];

    // Map Posts
    for (const child of rawPostItems) {
      if (child.kind === 't3' && child.data && typeof child.data === 'object' && 'title' in child.data) {
        const postData = child.data as RedditApiItemData;
        const postTextToAnalyze = `${postData.title || ''} ${postData.selftext || ''}`;
        const postSentimentResult = sentimentAnalyzer.analyze(postTextToAnalyze);
        let postSentiment: RedditPost['sentiment'] = 'neutral';
        if (postSentimentResult.score > 0.5) postSentiment = 'positive';
        else if (postSentimentResult.score < -0.5) postSentiment = 'negative';
        
        const mappedPost: RedditPost = {
          id: postData.name, // Fullname, e.g. t3_xxxxxx
          title: postData.title || 'No Title',
          content: postData.selftext || '',
          subreddit: postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
          author: postData.author || '[deleted]',
          timestamp: new Date((postData.created_utc || 0) * 1000).toISOString(),
          score: postData.score || 0,
          numComments: postData.num_comments || 0,
          url: (postData.url && postData.url.startsWith('http')) ? postData.url : `https://www.reddit.com${postData.permalink}`,
          flair: postData.link_flair_text || undefined,
          sentiment: postSentiment,
          type: 'Post',
        };
        allFetchedItems.push(mappedPost);

        // Phase 2: Fetch comments for this post
        const commentsForThisPost = await fetchCommentsForPost(
          postData.name, // Fullname, e.g., t3_xxxxxx
          postData.title || 'No Title',
          postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
          token,
          userAgent
        );
        allFetchedItems.push(...commentsForThisPost);
      }
    }
    console.log(`[Reddit API Service] Total items (posts + comments) BEFORE date filtering: ${allFetchedItems.length}`);
    
    // Date Filtering Logic
    console.log(`[Reddit API Service] Applying date filter: Items must be on or after ${CUTOFF_DATE_STRING} (Cutoff Timestamp: ${CUTOFF_TIMESTAMP})`);
    let itemsProcessedByFilter = 0;
    const itemsAfterDateFilter = allFetchedItems.filter((item, index) => {
      const itemDate = new Date(item.timestamp);
      const itemNumericTimestamp = itemDate.getTime();
      const isKept = itemNumericTimestamp >= CUTOFF_TIMESTAMP;
      
      itemsProcessedByFilter++;
      if (index < 5 || (index < 20 && !isKept && itemsProcessedByFilter <=20) ) {
        // console.log(`[Reddit API Filter Detail #${index+1}] Item ID: ${item.id}, Type: ${item.type}, Item Date: ${item.timestamp} (Num: ${itemNumericTimestamp}), Cutoff: ${CUTOFF_TIMESTAMP}, Kept: ${isKept}`);
      }
      return isKept;
    });
    
    const postsAfterFilter = itemsAfterDateFilter.filter(item => item.type === 'Post').length;
    const commentsAfterFilter = itemsAfterDateFilter.filter(item => item.type === 'Comment').length;
    console.log(`[Reddit API Service] After date filtering (>= ${CUTOFF_DATE_STRING}), ${itemsAfterDateFilter.length} items remain. (Posts: ${postsAfterFilter}, Comments: ${commentsAfterFilter})`);

    // Sort final combined list by timestamp (newest first)
    const finalSortedData = itemsAfterDateFilter.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const nextAfterCursor = rawPostResponseData.data?.after || null;
    console.log(`[Reddit API Service] Returning ${finalSortedData.length} items to client. Next cursor for posts: ${nextAfterCursor}`);

    return { data: finalSortedData, error: undefined, nextAfter: nextAfterCursor };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error.';
    console.error(`[Reddit API Service] Exception during Reddit search or processing:`, error);
    return { data: null, error: `Network or processing error: ${errorMessage}`, nextAfter: null };
  }
}
