
'use server';

import type { RedditPost, RedditSearchParams as ClientRedditSearchParams, User } from '@/types';
import { getApiKeys } from './api-key-service';
import Sentiment from 'sentiment';
import { db } from './firebase';
import { collection, query, where, getDocs, writeBatch, Timestamp, doc, deleteDoc } from 'firebase/firestore';

const REDDIT_CLIENT_ID_SERVICE_NAME = "Reddit Client ID";
const REDDIT_CLIENT_SECRET_SERVICE_NAME = "Reddit Client Secret";
const REDDIT_USER_AGENT_SERVICE_NAME = "Reddit User Agent";

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

const sentimentAnalyzer = new Sentiment();

const FILTER_PERIOD_DAYS = 30; // Fetch data from the last 30 days

// Calculate the cutoff timestamp for filtering items
const getCutoffTimestamp = (): number => {
  const date = new Date();
  date.setDate(date.getDate() - FILTER_PERIOD_DAYS);
  date.setHours(0, 0, 0, 0); // Start of the day
  return date.getTime();
};

const COMMENTS_PER_POST_LIMIT = 5;
const COMMENT_FETCH_DEPTH = 1;

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
  link_title?: string;
  num_comments?: number;
  link_flair_text?: string | null;
  selftext?: string;
  body?: string;
  url?: string;
  over_18?: boolean;
  replies?: RedditApiResponse | string;
  body_html?: string;
}

interface RedditApiChild {
  kind: 't1' | 't3' | 'more' | 'Listing';
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
  kind: string;
  data: RedditApiResponseData;
}

type RedditCommentsApiResponse = [RedditApiResponse, RedditApiResponse];

async function getRedditAccessToken(): Promise<{ token: string; userAgent: string } | { error: string }> {
  const apiKeys = await getApiKeys();
  const clientIdEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_ID_SERVICE_NAME);
  const clientSecretEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_SECRET_SERVICE_NAME);
  const userAgentEntry = apiKeys.find(k => k.serviceName === REDDIT_USER_AGENT_SERVICE_NAME);

  const userAgent = userAgentEntry ? userAgentEntry.keyValue : "InsightStreamApp/1.0 (FallbackUserAgent)";
  if (!userAgentEntry) {
    console.warn(`[Reddit API Service] Warning: '${REDDIT_USER_AGENT_SERVICE_NAME}' not found. Using fallback.`);
  }

  if (!clientIdEntry || !clientSecretEntry) {
    const errorMsg = `Critical: '${REDDIT_CLIENT_ID_SERVICE_NAME}' or '${REDDIT_CLIENT_SECRET_SERVICE_NAME}' not found in API Key Management. Reddit functionality impaired.`;
    console.error(`[Reddit API Service] ${errorMsg}`);
    return { error: errorMsg };
  }
  const clientId = clientIdEntry.keyValue;
  const clientSecret = clientSecretEntry.keyValue;

  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return { token: accessToken, userAgent };
  }

  try {
    console.log('[Reddit API Service] Attempting to fetch new Reddit access token...');
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
      return { error: `Failed to get Reddit token: ${errorData.message || response.statusText}` };
    }

    const tokenData = await response.json();
    accessToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000;
    console.log('[Reddit API Service] Successfully obtained new Reddit access token.');
    return { token: accessToken, userAgent };
  } catch (error) {
    console.error('[Reddit API Service] Exception fetching access token:', error);
    accessToken = null; tokenExpiry = null;
    return { error: `Exception getting Reddit token: ${(error as Error).message}` };
  }
}

export type RedditSearchParams = ClientRedditSearchParams;

async function fetchCommentsForPostInternal(
  postFullname: string,
  postTitle: string,
  postSubredditPrefixed: string,
  token: string,
  userAgent: string,
  queryKeywordsArray: string[],
  cutoffTimestamp: number
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
    const processedAt = new Date().toISOString();

    for (const child of rawCommentItems) {
      if (child.kind === 't1' && child.data && typeof child.data === 'object' && 'body' in child.data) {
        const commentData = child.data as RedditApiItemData;
        const commentTimestampMs = new Date((commentData.created_utc || 0) * 1000).getTime();

        if (commentTimestampMs >= cutoffTimestamp) {
            let sentiment: RedditPost['sentiment'] = 'unknown';
            try {
                const sentimentResult = sentimentAnalyzer.analyze(commentData.body || '');
                if (sentimentResult.score > 0.5) sentiment = 'positive';
                else if (sentimentResult.score < -0.5) sentiment = 'negative';
                else sentiment = 'neutral';
            } catch (e) {
                console.warn(`[Reddit API Service] Sentiment analysis failed for comment ${commentData.id}: ${(e as Error).message}. Defaulting to 'unknown'.`);
            }

            mappedComments.push({
              id: commentData.name,
              title: postTitle,
              content: commentData.body || '',
              subreddit: postSubredditPrefixed,
              author: commentData.author || '[deleted]',
              timestamp: new Date(commentTimestampMs).toISOString(),
              score: commentData.score || 0,
              numComments: 0,
              url: `https://www.reddit.com${commentData.permalink}`,
              flair: undefined,
              sentiment: sentiment,
              type: 'Comment',
              matchedKeyword: queryKeywordsArray.find(kw => commentData.body?.toLowerCase().includes(kw.toLowerCase())) || queryKeywordsArray[0] || 'general',
              processedAt: processedAt,
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

export async function syncUserRedditData(
  userId: string,
  userKeywords: string[]
): Promise<{ success: boolean; itemsFetchedAndStored: number; error?: string }> {
  console.log(`[Reddit API Service] Starting syncUserRedditData for userID: ${userId}, Keywords: ${userKeywords.join(', ')}`);

  if (!userKeywords || userKeywords.length === 0) {
    return { success: true, itemsFetchedAndStored: 0, error: "No keywords provided to sync." };
  }

  const authDetails = await getRedditAccessToken();
  if ('error' in authDetails) {
    return { success: false, itemsFetchedAndStored: 0, error: authDetails.error };
  }
  const { token, userAgent } = authDetails;

  const queryString = userKeywords.join(' OR ');
  // Fetch ~10 posts per keyword as a rough guide, capped at Reddit's max (usually 100 for search)
  const limit = Math.min(100, userKeywords.length * 10); 
  const sort = 'new';
  const time = 'month'; // Look for new posts in the last month to align with 30-day filter

  let searchUrl = `https://oauth.reddit.com/search.json?q=${encodeURIComponent(queryString)}&limit=${limit}&sort=${sort}&t=${time}&type=t3&restrict_sr=false&include_over_18=on`;
  
  console.log(`[Reddit API Service] Searching Reddit with query: "${queryString}", URL: ${searchUrl}`);
  const allFetchedItems: RedditPost[] = [];
  const cutoffTimestamp = getCutoffTimestamp();
  const processedAt = new Date().toISOString();

  try {
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[Reddit API Service] Error fetching posts from Reddit (${response.status}): ${errorText}`);
      return { success: false, itemsFetchedAndStored: 0, error: `Reddit API Error (${response.status}). Check console for details.` };
    }

    const responseData: RedditApiResponse = await response.json();
    const rawItems = responseData.data?.children || [];

    for (const child of rawItems) {
      if (child.kind === 't3' && child.data && typeof child.data === 'object' && 'title' in child.data) {
        const postData = child.data as RedditApiItemData;
        const postTimestampMs = new Date((postData.created_utc || 0) * 1000).getTime();

        if (postTimestampMs >= cutoffTimestamp) {
          let postSentiment: RedditPost['sentiment'] = 'unknown';
          try {
            const postSentimentText = `${postData.title || ''} ${postData.selftext || ''}`;
            const postSentimentResult = sentimentAnalyzer.analyze(postSentimentText);
            if (postSentimentResult.score > 0.5) postSentiment = 'positive';
            else if (postSentimentResult.score < -0.5) postSentiment = 'negative';
            else postSentiment = 'neutral';
          } catch (e) {
            console.warn(`[Reddit API Service] Sentiment analysis failed for post ${postData.id}: ${(e as Error).message}. Defaulting to 'unknown'.`);
          }
          
          const matchedKw = userKeywords.find(kw => 
                (postData.title?.toLowerCase().includes(kw.toLowerCase()) || 
                 postData.selftext?.toLowerCase().includes(kw.toLowerCase()))
            ) || userKeywords[0] || 'general';

          allFetchedItems.push({
            id: postData.name,
            title: postData.title || 'No Title',
            content: postData.selftext || '',
            subreddit: postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
            author: postData.author || '[deleted]',
            timestamp: new Date(postTimestampMs).toISOString(),
            score: postData.score || 0,
            numComments: postData.num_comments || 0,
            url: (postData.url && postData.url.startsWith('http')) ? postData.url : `https://www.reddit.com${postData.permalink}`,
            flair: postData.link_flair_text || undefined,
            type: 'Post',
            sentiment: postSentiment,
            matchedKeyword: matchedKw,
            processedAt: processedAt,
          });

          if (postData.num_comments && postData.num_comments > 0) {
            const commentsForThisPost = await fetchCommentsForPostInternal(
                postData.name,
                postData.title || 'No Title',
                postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
                token,
                userAgent,
                userKeywords,
                cutoffTimestamp
            );
            allFetchedItems.push(...commentsForThisPost);
          }
        }
      }
    }
    console.log(`[Reddit API Service] Fetched ${allFetchedItems.length} raw items (posts and comments) for query "${queryString}".`);

    // Delete existing items for the user
    const itemsSubcollectionRef = collection(db, 'reddit_data', userId, 'fetched_items');
    const existingItemsSnapshot = await getDocs(itemsSubcollectionRef);
    if (!existingItemsSnapshot.empty) {
        const deleteBatch = writeBatch(db);
        existingItemsSnapshot.docs.forEach(docSnap => deleteBatch.delete(docSnap.ref));
        await deleteBatch.commit();
        console.log(`[Reddit API Service] Deleted ${existingItemsSnapshot.size} existing items for user ${userId}.`);
    }


    // Batch write new items
    if (allFetchedItems.length > 0) {
        const batch = writeBatch(db);
        allFetchedItems.forEach(item => {
            // Ensure item.id is just the ID part, not "t1_" or "t3_" prefix for doc ID
            const docId = item.id.includes('_') ? item.id.split('_')[1] : item.id;
            if (!docId) {
                console.warn("[Reddit API Service] Skipping item with invalid ID structure:", item.id);
                return; 
            }
            const itemRef = doc(itemsSubcollectionRef, docId);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { sno, ...itemToSave } = item; // Remove client-side 'sno' if present
            batch.set(itemRef, itemToSave);
        });
        await batch.commit();
        console.log(`[Reddit API Service] Successfully stored ${allFetchedItems.length} new items for user ${userId}.`);
    } else {
        console.log(`[Reddit API Service] No new items to store for user ${userId} after filtering and processing.`);
    }
    
    return { success: true, itemsFetchedAndStored: allFetchedItems.length };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch/store error.';
    console.error(`[Reddit API Service] Exception during syncUserRedditData for user "${userId}":`, error);
    return { success: false, itemsFetchedAndStored: 0, error: `Sync error: ${errorMessage}` };
  }
}


export async function getStoredRedditFeedForUser(userId: string): Promise<RedditPost[]> {
  if (!userId) {
    console.warn('[Reddit API Service] getStoredRedditFeedForUser called with no userId.');
    return [];
  }
  try {
    const itemsCollectionRef = collection(db, 'reddit_data', userId, 'fetched_items');
    // Order by processedAt descending, then by timestamp descending as a secondary sort
    const q = query(itemsCollectionRef, where('timestamp', '!=', null)); // Ensure timestamp exists for sorting
    const querySnapshot = await getDocs(q);
    
    const posts = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id, // Use Firestore doc ID as primary id
        ...data,
        timestamp: data.timestamp || new Date(0).toISOString(), // Fallback for missing timestamp
      } as RedditPost;
    });

    // Sort in JavaScript as Firestore multiple inequality/orderBy can be tricky
    posts.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateB - dateA; // Most recent first
    });
    
    console.log(`[Reddit API Service] Fetched ${posts.length} stored Reddit items for user ${userId} from Firestore.`);
    return posts;
  } catch (error) {
    console.error(`[Reddit API Service] Error fetching stored Reddit feed for user ${userId}:`, error);
    return [];
  }
}
