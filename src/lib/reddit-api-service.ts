
'use server';

import type { RedditPost, RedditSearchParams as ClientRedditSearchParams } from '@/types';
import { getApiKeys } from './api-key-service';
import Sentiment from 'sentiment';
import { db } from './firebase';
import { collection, query, where, getDocs, writeBatch, Timestamp, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';

const REDDIT_CLIENT_ID_SERVICE_NAME = "Reddit Client ID";
const REDDIT_CLIENT_SECRET_SERVICE_NAME = "Reddit Client Secret";
const REDDIT_USER_AGENT_SERVICE_NAME = "Reddit User Agent";

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

const sentimentAnalyzer = new Sentiment();

const FILTER_PERIOD_DAYS = 30; 

const getCutoffTimestamp = (): number => {
  const date = new Date();
  date.setDate(date.getDate() - FILTER_PERIOD_DAYS);
  date.setHours(0, 0, 0, 0); 
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
    console.warn(`[Reddit API Service] getRedditAccessToken: Warning: '${REDDIT_USER_AGENT_SERVICE_NAME}' not found. Using fallback.`);
  }

  if (!clientIdEntry || !clientIdEntry.keyValue || !clientSecretEntry || !clientSecretEntry.keyValue) {
    const missingKeys = [];
    if (!clientIdEntry || !clientIdEntry.keyValue) missingKeys.push(`'${REDDIT_CLIENT_ID_SERVICE_NAME}'`);
    if (!clientSecretEntry || !clientSecretEntry.keyValue) missingKeys.push(`'${REDDIT_CLIENT_SECRET_SERVICE_NAME}'`);
    const errorMsg = `Critical: ${missingKeys.join(' or ')} not found or empty in API Key Management. Reddit functionality impaired.`;
    console.error(`[Reddit API Service] getRedditAccessToken: ${errorMsg}`);
    return { error: errorMsg };
  }
  const clientId = clientIdEntry.keyValue;
  const clientSecret = clientSecretEntry.keyValue;

  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('[Reddit API Service] getRedditAccessToken: Using existing valid access token.');
    return { token: accessToken, userAgent };
  }

  try {
    console.log('[Reddit API Service] getRedditAccessToken: Attempting to fetch new Reddit access token...');
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
      console.error('[Reddit API Service] getRedditAccessToken: Failed to obtain access token from Reddit API.', response.status, errorData);
      accessToken = null; tokenExpiry = null;
      return { error: `Failed to get Reddit token (${response.status}): ${errorData.message || response.statusText}` };
    }

    const tokenData = await response.json();
    accessToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000; // Subtract 5 mins for buffer
    console.log('[Reddit API Service] getRedditAccessToken: Successfully obtained and stored new Reddit access token.');
    return { token: accessToken, userAgent };
  } catch (error) {
    console.error('[Reddit API Service] getRedditAccessToken: Exception occurred while fetching access token:', error);
    accessToken = null; tokenExpiry = null;
    return { error: `Exception getting Reddit token: ${(error as Error).message}` };
  }
}


async function fetchCommentsForPostInternal(
  postFullname: string,
  postTitle: string,
  postSubredditPrefixed: string,
  token: string,
  userAgent: string,
  queryKeywordsArray: string[],
  cutoffTimestamp: number,
  processedAt: string // Pass processedAt for consistency
): Promise<RedditPost[]> {
  const postId = postFullname.startsWith('t3_') ? postFullname.substring(3) : postFullname;
  if (!postId) {
    console.warn(`[Reddit API Service] fetchCommentsForPostInternal: Invalid post fullname: ${postFullname}`);
    return [];
  }

  const commentsUrl = `https://oauth.reddit.com/comments/${postId}.json?sort=new&limit=${COMMENTS_PER_POST_LIMIT}&depth=${COMMENT_FETCH_DEPTH}&show_more=false&show_edits=false`;
  console.log(`[Reddit API Service] fetchCommentsForPostInternal: Fetching comments for post ${postId}`);

  try {
    const response = await fetch(commentsUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[Reddit API Service] fetchCommentsForPostInternal: Error fetching comments for post ${postId} (${response.status}): ${errorText}`);
      return []; // Return empty, let main sync decide if it's a fatal error
    }

    const responseData: RedditCommentsApiResponse = await response.json();
    if (!responseData || !Array.isArray(responseData) || responseData.length < 2 || !responseData[1] || !responseData[1].data || !responseData[1].data.children) {
        console.error(`[Reddit API Service] fetchCommentsForPostInternal: Unexpected response structure for comments of post ${postId}.`);
        return [];
    }
    
    const commentsListing = responseData[1];
    const rawCommentItems = commentsListing.data.children || [];
    const mappedComments: RedditPost[] = [];

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
                console.warn(`[Reddit API Service] fetchCommentsForPostInternal: Sentiment analysis failed for comment ${commentData.id}: ${(e as Error).message}. Defaulting to 'unknown'.`);
            }

            mappedComments.push({
              id: commentData.name, // e.g., t1_xxxxxx
              title: postTitle, // Parent post's title
              content: commentData.body || '',
              subreddit: postSubredditPrefixed,
              author: commentData.author || '[deleted]',
              timestamp: new Date(commentTimestampMs).toISOString(),
              score: commentData.score || 0,
              numComments: 0, // Comments don't have their own comment count in this context
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
    console.log(`[Reddit API Service] fetchCommentsForPostInternal: Fetched and processed ${mappedComments.length} comments for post ${postId}.`);
    return mappedComments;
  } catch (error) {
    console.error(`[Reddit API Service] fetchCommentsForPostInternal: Exception fetching/processing comments for post ${postId}:`, error);
    return []; // Return empty on major exception
  }
}

export async function syncUserRedditData(
  userId: string,
  userKeywords: string[]
): Promise<{ success: boolean; itemsFetchedAndStored: number; error?: string }> {
  console.log(`[Reddit API Service] syncUserRedditData: Starting for userID: ${userId}, Keywords: "${userKeywords.join('", "')}"`);

  if (!userKeywords || userKeywords.length === 0) {
    console.log("[Reddit API Service] syncUserRedditData: No keywords provided. Sync aborted.");
    return { success: true, itemsFetchedAndStored: 0, error: "No keywords assigned to sync." };
  }

  const authDetails = await getRedditAccessToken();
  if ('error' in authDetails) {
    console.error(`[Reddit API Service] syncUserRedditData: Failed to get Reddit access token. Error: ${authDetails.error}`);
    return { success: false, itemsFetchedAndStored: 0, error: `Reddit Authentication Failed: ${authDetails.error}` };
  }
  const { token, userAgent } = authDetails;

  const queryString = userKeywords.join(' OR ');
  const limit = Math.min(100, userKeywords.length * 10); 
  const sort = 'new';
  const time = 'month';

  const searchUrl = `https://oauth.reddit.com/search.json?q=${encodeURIComponent(queryString)}&limit=${limit}&sort=${sort}&t=${time}&type=t3&restrict_sr=false&include_over_18=on`;
  
  console.log(`[Reddit API Service] syncUserRedditData: Searching Reddit with URL: ${searchUrl}`);
  const allFetchedItems: RedditPost[] = [];
  const cutoffTimestamp = getCutoffTimestamp();
  const processedAt = new Date().toISOString(); // Single timestamp for all items in this batch

  try {
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[Reddit API Service] syncUserRedditData: Error fetching posts from Reddit API (${response.status}). Query: "${queryString}". Details: ${errorText}`);
      return { success: false, itemsFetchedAndStored: 0, error: `Reddit API Search Failed (${response.status}). Keywords: "${userKeywords.join('", "')}". Check server logs.` };
    }

    const responseData: RedditApiResponse = await response.json();
    const rawItems = responseData.data?.children || [];
    console.log(`[Reddit API Service] syncUserRedditData: Received ${rawItems.length} raw items from Reddit search.`);

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
            console.warn(`[Reddit API Service] syncUserRedditData: Sentiment analysis failed for post ${postData.id}: ${(e as Error).message}. Defaulting to 'unknown'.`);
          }
          
          const matchedKw = userKeywords.find(kw => 
                (postData.title?.toLowerCase().includes(kw.toLowerCase()) || 
                 postData.selftext?.toLowerCase().includes(kw.toLowerCase()))
            ) || userKeywords[0] || 'general';

          allFetchedItems.push({
            id: postData.name, // e.g. t3_xxxxxx
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
            console.log(`[Reddit API Service] syncUserRedditData: Post ${postData.name} has ${postData.num_comments} comments. Fetching relevant ones.`);
            const commentsForThisPost = await fetchCommentsForPostInternal(
                postData.name,
                postData.title || 'No Title',
                postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
                token,
                userAgent,
                userKeywords,
                cutoffTimestamp,
                processedAt
            );
            allFetchedItems.push(...commentsForThisPost);
          }
        } else {
          // console.log(`[Reddit API Service] syncUserRedditData: Post ${postData.name} timestamp ${new Date(postTimestampMs).toISOString()} is older than cutoff ${new Date(cutoffTimestamp).toISOString()}. Skipping.`);
        }
      }
    }
    console.log(`[Reddit API Service] syncUserRedditData: Processed ${allFetchedItems.length} total items (posts and comments) after filtering and comment fetching.`);

    const itemsSubcollectionRef = collection(db, 'reddit_data', userId, 'fetched_items');
    console.log(`[Reddit API Service] syncUserRedditData: Preparing to delete existing items for user ${userId} from ${itemsSubcollectionRef.path}.`);
    const existingItemsSnapshot = await getDocs(itemsSubcollectionRef);
    if (!existingItemsSnapshot.empty) {
        const deleteBatch = writeBatch(db);
        existingItemsSnapshot.docs.forEach(docSnap => deleteBatch.delete(docSnap.ref));
        await deleteBatch.commit();
        console.log(`[Reddit API Service] syncUserRedditData: Successfully deleted ${existingItemsSnapshot.size} existing items for user ${userId}.`);
    } else {
        console.log(`[Reddit API Service] syncUserRedditData: No existing items to delete for user ${userId}.`);
    }

    if (allFetchedItems.length > 0) {
        console.log(`[Reddit API Service] syncUserRedditData: Preparing to batch write ${allFetchedItems.length} new items for user ${userId}.`);
        const batch = writeBatch(db);
        allFetchedItems.forEach(item => {
            const docId = item.id.includes('_') ? item.id.split('_')[1] : item.id;
            if (!docId) {
                console.warn("[Reddit API Service] syncUserRedditData: Skipping item with invalid ID structure for Firestore doc ID:", item.id);
                return; 
            }
            const itemRef = doc(itemsSubcollectionRef, docId);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { sno, ...itemToSave } = item; 
            batch.set(itemRef, { ...itemToSave, serverTimestamp: serverTimestamp() });
        });
        await batch.commit();
        console.log(`[Reddit API Service] syncUserRedditData: Successfully stored ${allFetchedItems.length} new items for user ${userId}.`);
    } else {
        console.log(`[Reddit API Service] syncUserRedditData: No new items to store for user ${userId} after API fetch and processing.`);
    }
    
    return { success: true, itemsFetchedAndStored: allFetchedItems.length };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error.';
    console.error(`[Reddit API Service] syncUserRedditData: Exception for user "${userId}". Keywords: "${userKeywords.join('", "')}". Error:`, error);
    let specificError = `General Sync Exception: ${errorMessage}`;
    if (error instanceof Error && (error.message.includes('permission') || error.message.includes('PERMISSION_DENIED'))) {
        specificError = `Firestore Permission Error: ${errorMessage}. Check Firestore rules.`;
    } else if (error instanceof Error && error.message.includes('Quota exceeded')) {
        specificError = `API Quota Exceeded or Firestore Quota: ${errorMessage}`;
    }
    return { success: false, itemsFetchedAndStored: 0, error: specificError };
  }
}


export async function getStoredRedditFeedForUser(userId: string): Promise<RedditPost[]> {
  if (!userId) {
    console.warn('[Reddit API Service] getStoredRedditFeedForUser: Called with no userId.');
    return [];
  }
  console.log(`[Reddit API Service] getStoredRedditFeedForUser: Fetching stored items for user ${userId}.`);
  try {
    const itemsCollectionRef = collection(db, 'reddit_data', userId, 'fetched_items');
    const q = query(itemsCollectionRef, where('timestamp', '!=', null));
    const querySnapshot = await getDocs(q);
    
    const posts = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id, // Using Firestore doc ID, not the Reddit fullname (t3_xxxx)
        ...data,
        timestamp: data.timestamp || new Date(0).toISOString(), 
      } as RedditPost;
    });

    posts.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateB - dateA; 
    });
    
    console.log(`[Reddit API Service] getStoredRedditFeedForUser: Fetched ${posts.length} items for user ${userId} from Firestore.`);
    return posts;
  } catch (error) {
    console.error(`[Reddit API Service] getStoredRedditFeedForUser: Error fetching stored feed for user ${userId}:`, error);
    return [];
  }
}

// Function to save manually displayed Reddit items to Firestore (e.g., from a "Save this view" button)
// This function is NO LONGER USED by the automatic sync on page load. Kept for potential future use or reference.
export async function saveDisplayedRedditItems(
  userId: string,
  itemsToSave: RedditPost[]
): Promise<{ success: boolean; itemsSaved: number; error?: string }> {
  console.log(`[Reddit API Service] saveDisplayedRedditItems: Attempting to save ${itemsToSave.length} displayed items for user ${userId}.`);
  if (!itemsToSave || itemsToSave.length === 0) {
    return { success: true, itemsSaved: 0, error: "No items provided to save." };
  }

  try {
    const itemsSubcollectionRef = collection(db, 'reddit_data', userId, 'fetched_items');
    const batch = writeBatch(db);
    const currentTimestamp = new Date().toISOString();

    itemsToSave.forEach(item => {
      const docId = item.id.includes('_') ? item.id.split('_')[1] : item.id; // Use Reddit ID part for doc ID
      if (!docId) {
         console.warn("[Reddit API Service] saveDisplayedRedditItems: Skipping item with invalid ID structure for Firestore doc ID:", item.id);
         return;
      }
      const itemRef = doc(itemsSubcollectionRef, docId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { sno, ...itemData } = item; 
      batch.set(itemRef, { 
        ...itemData, 
        processedAt: itemData.processedAt || currentTimestamp, // Preserve original processedAt if exists, else use current
        serverTimestamp: serverTimestamp() // Add/update server timestamp
      });
    });

    await batch.commit();
    console.log(`[Reddit API Service] saveDisplayedRedditItems: Successfully saved ${itemsToSave.length} items for user ${userId}.`);
    return { success: true, itemsSaved: itemsToSave.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Firestore save error.';
    console.error(`[Reddit API Service] saveDisplayedRedditItems: Error saving displayed items for user ${userId}:`, error);
     let specificError = `Firestore Save Error: ${errorMessage}`;
    if (error instanceof Error && (error.message.includes('permission') || error.message.includes('PERMISSION_DENIED'))) {
        specificError = `Firestore Permission Error during save: ${errorMessage}. Check Firestore rules.`;
    }
    return { success: false, itemsSaved: 0, error: specificError };
  }
}
