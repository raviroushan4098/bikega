
'use server';

import type { RedditPost } from '@/types';
import { getApiKeys } from './api-key-service';
import Sentiment from 'sentiment';
import { db } from './firebase';
import { collection, query, where, getDocs, writeBatch, Timestamp, doc, serverTimestamp as firestoreServerTimestamp, deleteDoc, getDoc } from 'firebase/firestore';

const REDDIT_CLIENT_ID_SERVICE_NAME = "Reddit Client ID";
const REDDIT_CLIENT_SECRET_SERVICE_NAME = "Reddit Client Secret";
const REDDIT_USER_AGENT_SERVICE_NAME = "Reddit User Agent";

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

const sentimentAnalyzer = new Sentiment();

// const FILTER_PERIOD_DAYS = 30; // This is not used by getCutoffTimestamp currently

const getCutoffTimestamp = (): number => {
  // For fetching data from June 1st, 2025 onwards
  return new Date('2025-06-01T00:00:00.000Z').getTime();
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
  console.log('[Reddit API Service] getRedditAccessToken: Attempting to retrieve or generate Reddit access token.');
  const apiKeys = await getApiKeys();
  const clientIdEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_ID_SERVICE_NAME);
  const clientSecretEntry = apiKeys.find(k => k.serviceName === REDDIT_CLIENT_SECRET_SERVICE_NAME);
  const userAgentEntry = apiKeys.find(k => k.serviceName === REDDIT_USER_AGENT_SERVICE_NAME);

  const userAgent = userAgentEntry ? userAgentEntry.keyValue : "InsightStreamApp/1.0 (FallbackUserAgent)";
  if (!userAgentEntry) {
    console.warn(`[Reddit API Service] getRedditAccessToken: Warning: '${REDDIT_USER_AGENT_SERVICE_NAME}' not found in API Key Management. Using fallback.`);
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
  console.log('[Reddit API Service] getRedditAccessToken: Existing token invalid or expired. Fetching new token.');

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching token.';
    return { error: `Exception getting Reddit token: ${errorMessage}` };
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
  processedAt: string
): Promise<RedditPost[]> {
  const postId = postFullname.startsWith('t3_') ? postFullname.substring(3) : postFullname;
  if (!postId) {
    console.warn(`[Reddit API Service] fetchCommentsForPostInternal: Invalid post fullname: ${postFullname}, skipping comment fetch.`);
    return [];
  }

  const commentsUrl = `https://oauth.reddit.com/comments/${postId}.json?sort=new&limit=${COMMENTS_PER_POST_LIMIT}&depth=${COMMENT_FETCH_DEPTH}&show_more=false&show_edits=false`;
  console.log(`[Reddit API Service] fetchCommentsForPostInternal: Fetching comments for post ${postId} using URL: ${commentsUrl}`);

  try {
    const response = await fetch(commentsUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[Reddit API Service] fetchCommentsForPostInternal: Error fetching comments for post ${postId} (${response.status}): ${errorText}`);
      return [];
    }

    const responseData: RedditCommentsApiResponse = await response.json();
    if (!responseData || !Array.isArray(responseData) || responseData.length < 2 || !responseData[1] || !responseData[1].data || !responseData[1].data.children) {
        console.warn(`[Reddit API Service] fetchCommentsForPostInternal: Unexpected response structure for comments of post ${postId}. Data:`, JSON.stringify(responseData).substring(0, 500));
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
              id: commentData.name, // Use fullname (e.g., t1_xxxxxx) as ID
              title: postTitle, // Parent post's title
              content: commentData.body || '',
              subreddit: postSubredditPrefixed, // Parent post's subreddit
              author: commentData.author || '[deleted]',
              timestamp: new Date(commentTimestampMs).toISOString(),
              score: commentData.score || 0,
              numComments: 0, // Comments don't have their own 'numComments' in this display context
              url: `https://www.reddit.com${commentData.permalink}`,
              flair: null, // Comments don't have flairs
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error processing comments.';
    console.error(`[Reddit API Service] fetchCommentsForPostInternal: Exception fetching/processing comments for post ${postId}: ${errorMessage}`, error);
    return [];
  }
}

export async function syncUserRedditData(
  userId: string,
  userKeywords: string[]
): Promise<{ success: boolean; itemsFetchedAndStored: number; error?: string }> {
  console.log(`[Reddit API Service] syncUserRedditData: Starting sync for userID: ${userId}, Keywords: "${userKeywords.join('", "')}"`);

  console.log('[Reddit API Service] syncUserRedditData: Checking Firebase connectivity...');
  try {
    const testDocRef = doc(db, 'users', 'connectivity-test-doc-do-not-create'); // A non-existent doc path
    await getDoc(testDocRef); // Attempt a read. Success means connectivity and basic permissions are okay.
    console.log('[Reddit API Service] syncUserRedditData: Firebase connectivity check successful.');
  } catch (fbError) {
    const errorMessage = fbError instanceof Error ? fbError.message : 'Unknown Firebase connection error.';
    console.error('[Reddit API Service] syncUserRedditData: Firebase connectivity check FAILED.', fbError);
    // If this basic check fails, it's a fundamental issue with Firestore access.
    return { success: false, itemsFetchedAndStored: 0, error: `Firebase Connection/Permission Error: ${errorMessage}. Please check server logs and Firestore rules.` };
  }


  if (!userKeywords || userKeywords.length === 0) {
    console.log("[Reddit API Service] syncUserRedditData: No keywords provided. Sync aborted as there's nothing to search for.");
    return { success: true, itemsFetchedAndStored: 0, error: "No keywords assigned to sync." };
  }

  const authDetails = await getRedditAccessToken();
  if ('error' in authDetails) {
    console.error(`[Reddit API Service] syncUserRedditData: Failed to get Reddit access token. Error: ${authDetails.error}`);
    return { success: false, itemsFetchedAndStored: 0, error: `Reddit Authentication Failed: ${authDetails.error}` };
  }
  const { token, userAgent } = authDetails;
  console.log("[Reddit API Service] syncUserRedditData: Reddit access token and user agent obtained.");

  const queryString = userKeywords.map(kw => `"${kw}"`).join(' OR ');
  const limit = 100; // Fetch up to 100 posts from the API
  const sort = 'new'; // Fetch newest posts first
  // Removed 't' (time) parameter as it's generally not used effectively with sort=new for historical fetching

  const searchUrl = `https://oauth.reddit.com/search.json?q=${encodeURIComponent(queryString)}&limit=${limit}&sort=${sort}&type=t3&restrict_sr=false&include_over_18=on`;

  console.log(`[Reddit API Service] syncUserRedditData: Searching Reddit. Query: "${queryString}". URL: ${searchUrl}`);
  const allFetchedItems: RedditPost[] = [];
  const cutoffTimestamp = getCutoffTimestamp(); // Uses the fixed 2025-06-01 date
  const processedAt = new Date().toISOString();

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
            id: postData.name, // Use fullname (e.g., t3_xxxxxx) as ID
            title: postData.title || 'No Title',
            content: postData.selftext || '',
            subreddit: postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
            author: postData.author || '[deleted]',
            timestamp: new Date(postTimestampMs).toISOString(),
            score: postData.score || 0,
            numComments: postData.num_comments || 0,
            url: (postData.url && postData.url.startsWith('http')) ? postData.url : `https://www.reddit.com${postData.permalink}`,
            flair: postData.link_flair_text === undefined ? null : postData.link_flair_text,
            type: 'Post',
            sentiment: postSentiment,
            matchedKeyword: matchedKw,
            processedAt: processedAt,
          });

          // Consider if fetching comments is still desired here given the limit.
          // If allFetchedItems can reach 100 from posts alone, comment fetching might exceed desired scope for this sync.
          if (postData.num_comments && postData.num_comments > 0 && allFetchedItems.length < (limit * 1.5)) { // Adjusted limit for including comments
            console.log(`[Reddit API Service] syncUserRedditData: Post ${postData.name} has ${postData.num_comments} comments. Fetching relevant ones.`);
            const commentsForThisPost = await fetchCommentsForPostInternal(
                postData.name, // Fullname of the post
                postData.title || 'No Title',
                postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
                token,
                userAgent,
                userKeywords, // Pass userKeywords for comment matching
                cutoffTimestamp,
                processedAt
            );
            allFetchedItems.push(...commentsForThisPost);
          }
        }
      }
    }
    console.log(`[Reddit API Service] syncUserRedditData: Processed ${allFetchedItems.length} total items (posts and comments) after initial filtering and comment fetching.`);

    const itemsSubcollectionRef = collection(db, 'reddit_data', userId, 'fetched_items');
    console.log(`[Reddit API Service] syncUserRedditData: Preparing to delete existing items for user ${userId} from ${itemsSubcollectionRef.path}.`);

    try {
      const existingItemsSnapshot = await getDocs(itemsSubcollectionRef);
      if (!existingItemsSnapshot.empty) {
          const deleteBatch = writeBatch(db);
          existingItemsSnapshot.docs.forEach(docSnap => deleteBatch.delete(docSnap.ref));
          await deleteBatch.commit();
          console.log(`[Reddit API Service] syncUserRedditData: Successfully deleted ${existingItemsSnapshot.size} existing items for user ${userId}.`);
      } else {
          console.log(`[Reddit API Service] syncUserRedditData: No existing items to delete for user ${userId}.`);
      }
    } catch (deleteError) {
        console.error(`[Reddit API Service] syncUserRedditData: Error deleting existing Firestore items for user ${userId}:`, deleteError);
        const errorMessage = deleteError instanceof Error ? deleteError.message : 'Unknown Firestore delete error.';
        return { success: false, itemsFetchedAndStored: 0, error: `Firestore Delete Failed: ${errorMessage}` };
    }

    if (allFetchedItems.length > 0) {
        console.log(`[Reddit API Service] syncUserRedditData: Preparing to batch write ${allFetchedItems.length} new items for user ${userId}.`);
        try {
            const batch = writeBatch(db);
            allFetchedItems.forEach(item => {
                const docId = item.id.includes('_') ? item.id.split('_')[1] : item.id;
                if (!docId) {
                    console.warn("[Reddit API Service] syncUserRedditData: Skipping item with invalid ID structure for Firestore doc ID:", item.id);
                    return;
                }
                const itemRef = doc(itemsSubcollectionRef, docId);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { sno, ...restOfItem } = item; // Remove sno if it exists
                const itemToSaveClean = {
                  ...restOfItem,
                  flair: restOfItem.flair === undefined ? null : restOfItem.flair,
                  content: restOfItem.content === undefined || restOfItem.content === null ? '' : restOfItem.content,
                };

                batch.set(itemRef, { ...itemToSaveClean, serverTimestamp: firestoreServerTimestamp() });
            });
            await batch.commit();
            console.log(`[Reddit API Service] syncUserRedditData: Successfully stored ${allFetchedItems.length} new items for user ${userId}.`);
        } catch (writeError) {
            console.error(`[Reddit API Service] syncUserRedditData: Error writing new Firestore items for user ${userId}:`, writeError);
            const errorMessage = writeError instanceof Error ? writeError.message : 'Unknown Firestore write error.';
            return { success: false, itemsFetchedAndStored: 0, error: `Firestore Write Failed: ${errorMessage}` };
        }
    } else {
        console.log(`[Reddit API Service] syncUserRedditData: No new items to store for user ${userId} after API fetch and processing.`);
    }

    console.log(`[Reddit API Service] syncUserRedditData: Sync completed for user ${userId}. Items fetched and stored: ${allFetchedItems.length}.`);
    return { success: true, itemsFetchedAndStored: allFetchedItems.length };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error.';
    console.error(`[Reddit API Service] syncUserRedditData: General Exception for user "${userId}". Keywords: "${userKeywords.join('", "')}". Error: ${errorMessage}`, error);
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
    const q = query(itemsCollectionRef, where('timestamp', '!=', null)); // Basic query, can be ordered by serverTimestamp
    const querySnapshot = await getDocs(q);

    const posts = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { serverTimestamp, sno, ...restOfData } = data; // Exclude serverTimestamp and sno
      return {
        id: docSnap.id, // Use Firestore document ID as the primary ID for the object
        ...restOfData,
        timestamp: restOfData.timestamp || new Date(0).toISOString(), // Ensure timestamp is a string
        flair: restOfData.flair === undefined ? null : restOfData.flair, // Ensure flair is string or null
        content: restOfData.content === undefined || restOfData.content === null ? '' : restOfData.content, // Ensure content is a string
      } as RedditPost;
    });

    // Sort by timestamp client-side after fetching, descending (newest first)
    posts.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateB - dateA;
    });

    console.log(`[Reddit API Service] getStoredRedditFeedForUser: Fetched ${posts.length} items for user ${userId} from Firestore.`);
    return posts;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching stored feed.';
    console.error(`[Reddit API Service] getStoredRedditFeedForUser: Error fetching stored feed for user ${userId}: ${errorMessage}`, error);
    return [];
  }
}
