
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

const COMMENTS_PER_POST_LIMIT = 5; // Limit comments per post to avoid excessive API calls
const COMMENT_FETCH_DEPTH = 1; 

// Define interfaces for Reddit API responses (simplified)
interface RedditApiItemData {
  id: string;
  name: string; // fullname, e.g. t3_xxxxxx
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
  subreddit_name_prefixed?: string;
  subreddit?: string;
  title?: string; // For posts
  link_title?: string; // For comments, title of parent post
  num_comments?: number; // For posts
  link_flair_text?: string | null;
  selftext?: string; // For posts
  body?: string; // For comments
  url?: string; // For posts, the URL they link to or their own permalink
  over_18?: boolean;
  replies?: RedditApiResponse | string; // For comments, can be complex
  body_html?: string;
}

interface RedditApiChild {
  kind: 't1' | 't3' | 'more' | 'Listing'; // t1 for comment, t3 for post
  data: RedditApiItemData | RedditApiResponseData;
}

interface RedditApiResponseData {
  after: string | null;
  dist: number;
  children: RedditApiChild[];
  before: string | null;
  modhash?: string;
}

interface RedditApiResponse {
  kind: string; // e.g., "Listing"
  data: RedditApiResponseData;
}

type RedditCommentsApiResponse = [RedditApiResponse, RedditApiResponse];


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

export type RedditSearchParams = ClientRedditSearchParams;


async function fetchCommentsForPost(
  postFullname: string,
  postTitle: string,
  postSubredditPrefixed: string,
  token: string,
  userAgent: string,
  queryKeywordsArray: string[]
): Promise<RedditPost[]> {
  const postId = postFullname.startsWith('t3_') ? postFullname.substring(3) : postFullname;
  if (!postId) {
    console.warn(`[Reddit API Service] Invalid post fullname for fetching comments: ${postFullname}`);
    return [];
  }

  const commentsUrl = `https://oauth.reddit.com/comments/${postId}.json?sort=new&limit=${COMMENTS_PER_POST_LIMIT}&depth=${COMMENT_FETCH_DEPTH}&show_more=false&show_edits=false`;
  
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
     if (!responseData || !Array.isArray(responseData) || responseData.length < 2 || !responseData[1] || !responseData[1].data || !responseData[1].data.children) {
        console.error(`[Reddit API Service] Unexpected response structure for comments of post ${postId}.`);
        return [];
    }
    
    const commentsListing = responseData[1];
    const rawCommentItems = commentsListing.data.children || [];
    
    const mappedComments: RedditPost[] = [];
    for (const child of rawCommentItems) {
      if (child.kind === 't1' && child.data && typeof child.data === 'object' && 'body' in child.data) {
        const commentData = child.data as RedditApiItemData;
        const commentTimestamp = new Date((commentData.created_utc || 0) * 1000).getTime();

        if (commentTimestamp >= CUTOFF_TIMESTAMP) {
            const sentimentResult = sentimentAnalyzer.analyze(commentData.body || '');
            let sentiment: RedditPost['sentiment'] = 'neutral';
            if (sentimentResult.score > 0.5) sentiment = 'positive';
            else if (sentimentResult.score < -0.5) sentiment = 'negative';

            mappedComments.push({
              id: commentData.name, // fullname, e.g., t1_xxxxxx
              title: postTitle, // Parent post's title
              content: commentData.body || '',
              subreddit: postSubredditPrefixed,
              author: commentData.author || '[deleted]',
              timestamp: new Date(commentTimestamp).toISOString(),
              score: commentData.score || 0,
              numComments: 0, // Not relevant for individual comments in this context
              url: `https://www.reddit.com${commentData.permalink}`,
              flair: undefined, // Comments don't typically have flair in the same way posts do
              sentiment: sentiment,
              type: 'Comment',
              matchedKeyword: queryKeywordsArray.find(kw => commentData.body?.toLowerCase().includes(kw.toLowerCase())) || queryKeywordsArray[0]
            });
        }
      }
    }
    return mappedComments;

  } catch (error) {
    console.error(`[Reddit API Service] Exception fetching/processing comments for post ${postId}:`, error);
    return [];
  }
}


export async function searchReddit(
  params: RedditSearchParams
): Promise<{ data: RedditPost[] | null; error?: string; next?: string | null }> {
  const token = await getRedditAccessToken();
  if (!token) {
    return { data: null, error: "Failed to authenticate with Reddit. Check API Key Management." };
  }

  const apiKeys = await getApiKeys();
  const userAgentEntry = apiKeys.find(k => k.serviceName === REDDIT_USER_AGENT_SERVICE_NAME);
  const userAgent = userAgentEntry ? userAgentEntry.keyValue : "InsightStreamApp/1.0 (FallbackUserAgent)";
   if (!userAgentEntry) {
        console.warn(`[Reddit API Service] Warning: '${REDDIT_USER_AGENT_SERVICE_NAME}' not found. Using fallback.`);
    }

  const { q, limit = 25, sort = 'new', t: time = 'all', after } = params;
  const queryKeywordsArray = q.split(' OR ').map(kw => kw.trim()).filter(kw => kw);

  let searchUrl = `https://oauth.reddit.com/search.json?q=${encodeURIComponent(q)}&limit=${limit}&sort=${sort}&t=${time}&type=t3&restrict_sr=false&include_over_18=on`;
  if (after) {
    searchUrl += `&after=${after}`;
  }

  console.log(`[Reddit API Service] Searching Reddit with query: "${q}", URL: ${searchUrl}`);

  try {
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[Reddit API Service] Error fetching posts from Reddit (${response.status}): ${errorText}`);
      return { data: null, error: `Reddit API Error (${response.status}). Check console for details.` };
    }

    const responseData: RedditApiResponse = await response.json();
    const rawItems = responseData.data?.children || [];
    const allFetchedItems: RedditPost[] = [];

    for (const child of rawItems) {
      if (child.kind === 't3' && child.data && typeof child.data === 'object' && 'title' in child.data) {
        const postData = child.data as RedditApiItemData;
        const postTimestamp = new Date((postData.created_utc || 0) * 1000).getTime();

        if (postTimestamp >= CUTOFF_TIMESTAMP) {
          const postSentimentText = `${postData.title || ''} ${postData.selftext || ''}`;
          const postSentimentResult = sentimentAnalyzer.analyze(postSentimentText);
          let postFinalSentiment: RedditPost['sentiment'] = 'neutral';
          if (postSentimentResult.score > 0.5) postFinalSentiment = 'positive';
          else if (postSentimentResult.score < -0.5) postFinalSentiment = 'negative';
          
          const matchedKw = queryKeywordsArray.find(kw => 
                (postData.title?.toLowerCase().includes(kw.toLowerCase()) || 
                 postData.selftext?.toLowerCase().includes(kw.toLowerCase()))
            ) || queryKeywordsArray[0];


          allFetchedItems.push({
            id: postData.name, // fullname, e.g., t3_xxxxxx
            title: postData.title || 'No Title',
            content: postData.selftext || '',
            subreddit: postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
            author: postData.author || '[deleted]',
            timestamp: new Date(postTimestamp).toISOString(),
            score: postData.score || 0,
            numComments: postData.num_comments || 0,
            url: (postData.url && postData.url.startsWith('http')) ? postData.url : `https://www.reddit.com${postData.permalink}`,
            flair: postData.link_flair_text || undefined,
            type: 'Post',
            sentiment: postFinalSentiment,
            matchedKeyword: matchedKw
          });

          // Fetch comments for this post
          if (postData.num_comments && postData.num_comments > 0) {
            const commentsForThisPost = await fetchCommentsForPost(
                postData.name,
                postData.title || 'No Title',
                postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
                token,
                userAgent,
                queryKeywordsArray
            );
            // The fetchCommentsForPost already filters by CUTOFF_TIMESTAMP
            allFetchedItems.push(...commentsForThisPost);
          }
        }
      }
    }
    console.log(`[Reddit API Service] Found ${allFetchedItems.length} items (posts and comments) for query "${q}".`);
    return { data: allFetchedItems, next: responseData.data?.after || null };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error.';
    console.error(`[Reddit API Service] Exception during searchReddit for query "${q}":`, error);
    return { data: null, error: `Network or processing error: ${errorMessage}` };
  }
}
