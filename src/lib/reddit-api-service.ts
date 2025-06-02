
'use server';

import type { RedditPost, RedditSearchParams as ClientRedditSearchParams } from '@/types';
import { getApiKeys } from './api-key-service';

const REDDIT_CLIENT_ID_SERVICE_NAME = "Reddit Client ID";
const REDDIT_CLIENT_SECRET_SERVICE_NAME = "Reddit Client Secret";
const REDDIT_USER_AGENT_SERVICE_NAME = "Reddit User Agent";

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

const POSTS_PER_PAGE_LIMIT = 50; // Max posts to fetch in one go for the main search
const COMMENTS_PER_POST_LIMIT = 10; // Max comments to fetch per post

async function getRedditAccessToken(): Promise<string | null> {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const apiKeys = await getApiKeys();
  const clientIdEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_ID_SERVICE_NAME);
  const clientSecretEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_SECRET_SERVICE_NAME);

  if (!clientIdEntry || !clientSecretEntry) {
    console.error(`[Reddit API Service] Critical: '${REDDIT_CLIENT_ID_SERVICE_NAME}' or '${REDDIT_CLIENT_SECRET_SERVICE_NAME}' not found. Please add them.`);
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
      // Log more details if possible
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
    return accessToken;
  } catch (error) {
    console.error('[Reddit API Service] Error fetching access token:', error);
    accessToken = null;
    tokenExpiry = null;
    return null;
  }
}

export type { ClientRedditSearchParams as RedditSearchParams };

interface RedditApiItemData {
  id: string; // Bare ID for comments, fullname (t3_xxx) for posts from search
  name: string; // Fullname (t1_xxx or t3_xxx)
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
  subreddit_name_prefixed?: string; // For posts from search
  subreddit?: string; // For comments
  title?: string; // For posts
  num_comments?: number; // For posts
  link_flair_text?: string | null;
  selftext?: string; // For posts
  body?: string; // For comments
  url?: string; // For posts
  // Potentially other fields like `link_title` for comments from search, but not from /comments/ endpoint
}

interface RedditApiChild {
  kind: 't1' | 't3' | 'more'; // t1 for comment, t3 for link/post
  data: RedditApiItemData;
}

interface RedditApiResponseData {
  after: string | null;
  dist: number;
  children: RedditApiChild[];
  before: string | null;
}

interface RedditApiResponse { // For /search.json
  kind: string;
  data: RedditApiResponseData;
}

// For /comments/{postId}.json response
type RedditCommentApiResponse = [
  { kind: 't3', data: RedditApiItemData }, // Post data
  { kind: 'Listing', data: RedditApiResponseData } // Comments listing
];


async function fetchCommentsForPost(
  postFullname: string, // e.g., t3_xyz
  postTitle: string, 
  postSubredditPrefixed: string,
  token: string,
  userAgent: string,
  limit: number = COMMENTS_PER_POST_LIMIT
): Promise<RedditPost[]> {
  const postIdWithoutPrefix = postFullname.startsWith('t3_') ? postFullname.substring(3) : postFullname;
  // Using depth=1 to fetch only top-level comments for simplicity and to limit data.
  const commentsUrl = `https://oauth.reddit.com/comments/${postIdWithoutPrefix}.json?sort=new&limit=${limit}&depth=1`;

  // console.log(`[Reddit API Service] Fetching comments for post ${postFullname} (ID: ${postIdWithoutPrefix}): ${commentsUrl}`);
  try {
    const response = await fetch(commentsUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[Reddit API Service] Error fetching comments for post ${postIdWithoutPrefix} (${response.status}): ${errorText}`);
      return [];
    }

    const responseData = await response.json() as RedditCommentApiResponse;

    if (!Array.isArray(responseData) || responseData.length < 2 || !responseData[1].data || !responseData[1].data.children) {
      console.warn(`[Reddit API Service] Unexpected comment data structure for post ${postIdWithoutPrefix}. May have no comments or error. Response:`, JSON.stringify(responseData).substring(0, 500));
      return [];
    }
    
    const commentChildren = responseData[1].data.children;
    const fetchedComments: RedditPost[] = [];

    for (const child of commentChildren) {
      if (child.kind === 't1') { // 't1' is a comment
        const commentData = child.data;
        fetchedComments.push({
          id: commentData.name || `t1_${commentData.id}`, // 'name' is fullname (e.g. t1_xxxx). 'id' is bare.
          title: postTitle, // Use the parent post's title for context
          content: commentData.body || '',
          subreddit: commentData.subreddit_name_prefixed || `r/${commentData.subreddit}` || postSubredditPrefixed,
          author: commentData.author || '[deleted]',
          timestamp: new Date((commentData.created_utc || 0) * 1000).toISOString(),
          score: commentData.score || 0,
          numComments: 0, // This field on comment refers to its own replies, not parent post.
          url: `https://www.reddit.com${commentData.permalink}`,
          flair: undefined, 
          sentiment: 'unknown',
          type: 'Comment',
        });
      }
    }
    // console.log(`[Reddit API Service] Fetched ${fetchedComments.length} comments for post ${postIdWithoutPrefix}`);
    return fetchedComments;
  } catch (error) {
    console.error(`[Reddit API Service] Exception fetching comments for post ${postIdWithoutPrefix}:`, error);
    return [];
  }
}


export async function searchReddit(
  params: ClientRedditSearchParams
): Promise<{ data: RedditPost[] | null; error?: string; nextAfter?: string | null }> {
  const token = await getRedditAccessToken();
  if (!token) {
    return { data: null, error: "Failed to authenticate with Reddit. Check API logs and ensure Client ID & Secret are correctly set.", nextAfter: null };
  }

  const apiKeys = await getApiKeys();
  const userAgentEntry = apiKeys.find(k => k.serviceName === REDDIT_USER_AGENT_SERVICE_NAME);
  const userAgent = userAgentEntry ? userAgentEntry.keyValue : "InsightStreamApp/1.0 (FallbackUserAgent)";
   if (!userAgentEntry) {
      console.warn(`[Reddit API Service] Warning: '${REDDIT_USER_AGENT_SERVICE_NAME}' not found. Using fallback.`);
  }

  const { q, sort = 'new', t = 'all', subreddit, limit = 100, after } = params;
  
  // Fetch Posts
  let postsApiUrl = `https://oauth.reddit.com/`;
  if (subreddit) {
    const cleanSubreddit = subreddit.startsWith('r/') ? subreddit.substring(2) : subreddit;
    postsApiUrl += `r/${cleanSubreddit}/`;
  }
  postsApiUrl += `search.json?q=${encodeURIComponent(q)}&limit=${POSTS_PER_PAGE_LIMIT}&sort=${sort}&t=${t}&type=link&show=all&restrict_sr=${!!subreddit}&include_over_18=on`;
  if (after) {
    postsApiUrl += `&after=${after}`;
  }

  const allFetchedItems: RedditPost[] = [];
  let postsNextCursor: string | null = null;
  let postsError: string | undefined = undefined;

  // console.log(`[Reddit API Service] Fetching posts (limit ${POSTS_PER_PAGE_LIMIT}): ${postsApiUrl.replace(q,encodeURIComponent(q))}`);
  try {
    const postResponse = await fetch(postsApiUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text().catch(() => `Status: ${postResponse.status}`);
      console.error(`[Reddit API Service] Error fetching posts (${postResponse.status}): ${errorText}`);
      postsError = `Reddit API Error for posts (${postResponse.status}).`;
    } else {
      const rawPostData: RedditApiResponse = await postResponse.json();
      if (rawPostData && rawPostData.data && rawPostData.data.children) {
        const fetchedPosts = rawPostData.data.children
          .filter(child => child.kind === 't3')
          .map(child => {
            const data = child.data;
            return {
              id: data.name || `t3_${data.id}`, // 'name' is fullname
              title: data.title || 'No Title',
              content: data.selftext || '',
              subreddit: data.subreddit_name_prefixed || `r/${data.subreddit}`,
              author: data.author || '[deleted]',
              timestamp: new Date((data.created_utc || 0) * 1000).toISOString(),
              score: data.score || 0,
              numComments: data.num_comments || 0,
              url: data.url && data.url.startsWith('http') ? data.url : `https://www.reddit.com${data.permalink}`,
              flair: data.link_flair_text || undefined,
              sentiment: 'unknown',
              type: 'Post',
            } as RedditPost;
          });
        allFetchedItems.push(...fetchedPosts);
        postsNextCursor = rawPostData.data.after;

        // Fetch comments for these posts
        if (fetchedPosts.length > 0) {
          // console.log(`[Reddit API Service] Initiating comment fetching for ${fetchedPosts.length} posts.`);
          const commentPromises = fetchedPosts.map(post =>
            fetchCommentsForPost(post.id, post.title, post.subreddit, token, userAgent, COMMENTS_PER_POST_LIMIT)
          );
          const commentArrays = await Promise.all(commentPromises);
          commentArrays.forEach(comments => allFetchedItems.push(...comments));
          // console.log(`[Reddit API Service] Total items after fetching comments: ${allFetchedItems.length}`);
        }
      } else {
         console.warn(`[Reddit API Service] Unexpected post search response structure.`);
         postsError = "Invalid API response for posts.";
      }
    }
  } catch (error) {
    console.error(`[Reddit API Service] Exception fetching posts:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error.';
    postsError = `Network or parsing error for posts: ${errorMessage}`;
  }

  if (postsError && allFetchedItems.length === 0) {
    return { data: null, error: postsError, nextAfter: null };
  }

  // Sort all combined items by timestamp (newest first)
  allFetchedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Apply the overall limit from params, if provided, otherwise it's effectively POSTS_PER_PAGE_LIMIT + comments
  // This 'limit' from params is a bit ambiguous now. Let's interpret it as roughly how many posts to target.
  // The actual number of items returned will be more due to comments.
  // For now, we return all fetched items from this pass, relying on POSTS_PER_PAGE_LIMIT for posts.
  
  const finalData = allFetchedItems; // We no longer slice here by `params.limit` as that's handled by post fetch and comment fetch limits.

  const postCountInBatch = finalData.filter(p => p.type === 'Post').length;
  const commentCountInBatch = finalData.filter(p => p.type === 'Comment').length;
  // console.log(`[Reddit API Service] searchReddit returned: ${postCountInBatch} posts, ${commentCountInBatch} comments. Total: ${finalData.length}. Next post cursor: ${postsNextCursor}`);

  return { data: finalData, error: postsError, nextAfter: postsNextCursor };
}
