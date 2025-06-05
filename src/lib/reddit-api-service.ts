
'use server';

import type { RedditPost } from '@/types';
import { getApiKeys } from './api-key-service';
import { analyzeAdvancedSentiment, type AdvancedSentimentInput } from '@/ai/flows/advanced-sentiment-flow';
import { db } from './firebase';
import { collection, query, where, getDocs, writeBatch, Timestamp, doc, serverTimestamp as firestoreServerTimestamp, orderBy, getDoc } from 'firebase/firestore';

const REDDIT_CLIENT_ID_SERVICE_NAME = "Reddit Client ID";
const REDDIT_CLIENT_SECRET_SERVICE_NAME = "Reddit Client Secret";
const REDDIT_USER_AGENT_SERVICE_NAME = "Reddit User Agent";

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

const FETCH_PERIOD_DAYS = 30; // Fetch data from the last 30 days on refresh
const COMMENTS_PER_POST_LIMIT = 5; // Max comments to fetch per post
const COMMENT_FETCH_DEPTH = 1; // Depth of comments to fetch
const API_CALL_DELAY_MS = 1500; // Delay in milliseconds between sentiment API calls (1.5 seconds)

// Utility function to introduce a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    console.warn(`[Reddit API Service] getRedditAccessToken: Warning: '${REDDIT_USER_AGENT_SERVICE_NAME}' not found. Using fallback.`);
  }

  if (!clientIdEntry || !clientIdEntry.keyValue || !clientSecretEntry || !clientSecretEntry.keyValue) {
    const missingKeys = [];
    if (!clientIdEntry || !clientIdEntry.keyValue) missingKeys.push(`'${REDDIT_CLIENT_ID_SERVICE_NAME}'`);
    if (!clientSecretEntry || !clientSecretEntry.keyValue) missingKeys.push(`'${REDDIT_CLIENT_SECRET_SERVICE_NAME}'`);
    const errorMsg = `Critical: ${missingKeys.join(' or ')} not found or empty. Reddit functionality impaired.`;
    console.error(`[Reddit API Service] getRedditAccessToken: ${errorMsg}`);
    return { error: errorMsg };
  }
  const clientId = clientIdEntry.keyValue;
  const clientSecret = clientSecretEntry.keyValue;

  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('[Reddit API Service] getRedditAccessToken: Using existing valid access token.');
    return { token: accessToken, userAgent };
  }
  console.log('[Reddit API Service] getRedditAccessToken: Existing token invalid/expired. Fetching new token.');

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
      console.error('[Reddit API Service] getRedditAccessToken: Failed to obtain access token.', response.status, errorData);
      accessToken = null; tokenExpiry = null;
      return { error: `Failed to get Reddit token (${response.status}): ${errorData.message || response.statusText}` };
    }

    const tokenData = await response.json();
    accessToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000; // Buffer
    console.log('[Reddit API Service] getRedditAccessToken: Successfully obtained new Reddit access token.');
    return { token: accessToken, userAgent };
  } catch (error) {
    console.error('[Reddit API Service] getRedditAccessToken: Exception fetching access token:', error);
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
  fetchSinceTimestamp: number,
  processedAt: string
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
      return [];
    }

    const responseData: RedditCommentsApiResponse = await response.json();
    if (!responseData || !Array.isArray(responseData) || responseData.length < 2 || !responseData[1] || !responseData[1].data || !responseData[1].data.children) {
        console.warn(`[Reddit API Service] fetchCommentsForPostInternal: Unexpected response for comments of post ${postId}.`);
        return [];
    }

    const commentsListing = responseData[1];
    const rawCommentItems = (commentsListing.data.children || []).filter(child => {
        const commentData = child.data as RedditApiItemData;
        const commentTimestampMs = new Date((commentData.created_utc || 0) * 1000).getTime();
        return child.kind === 't1' && child.data && typeof child.data === 'object' && 'body' in child.data && commentTimestampMs >= fetchSinceTimestamp;
    });

    const mappedComments: RedditPost[] = [];

    for (const child of rawCommentItems) {
        const commentData = child.data as RedditApiItemData;
        const commentBody = commentData.body || '';
        let sentimentResult = { sentiment: 'neutral' as RedditPost['sentiment'], error: undefined as string | undefined };
        
        if (commentBody.trim()) {
            const sentimentAnalysisInput: AdvancedSentimentInput = { text: commentBody };
            console.log(`[Reddit API Service] COMMENT: Preparing to analyze sentiment for comment ID: ${commentData.id}, Text (first 30): "${commentBody.substring(0,30)}..."`);
            await delay(API_CALL_DELAY_MS); // Add delay here
            sentimentResult = await analyzeAdvancedSentiment(sentimentAnalysisInput);
            console.log(`[Reddit API Service] COMMENT: Sentiment analysis COMPLETE for comment ID: ${commentData.id}. Raw Result: ${JSON.stringify(sentimentResult)}`);
        }

        const commentTimestampMs = new Date((commentData.created_utc || 0) * 1000).getTime();
        let finalSentiment = sentimentResult.sentiment;
        if (sentimentResult.error) {
            console.warn(`[Reddit API Service] Advanced sentiment analysis failed for comment ${commentData.id}: ${sentimentResult.error}. Defaulting to 'unknown'.`);
            finalSentiment = 'unknown';
        }

        mappedComments.push({
            id: commentData.name,
            title: postTitle,
            content: commentBody,
            subreddit: postSubredditPrefixed,
            author: commentData.author || '[deleted]',
            timestamp: new Date(commentTimestampMs).toISOString(),
            score: commentData.score || 0,
            numComments: 0, 
            url: `https://www.reddit.com${commentData.permalink}`,
            flair: null, 
            sentiment: finalSentiment,
            type: 'Comment',
            matchedKeyword: queryKeywordsArray.find(kw => commentData.body?.toLowerCase().includes(kw.toLowerCase())) || queryKeywordsArray[0] || 'general',
            processedAt: processedAt,
        });
    }
    
    console.log(`[Reddit API Service] fetchCommentsForPostInternal: Processed ${mappedComments.length} comments for post ${postId}.`);
    return mappedComments;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error processing comments.';
    console.error(`[Reddit API Service] fetchCommentsForPostInternal: Exception processing comments for post ${postId}: ${errorMessage}`, error);
    return [];
  }
}

export async function refreshUserRedditData(
  userId: string,
  userKeywords: string[]
): Promise<{ success: boolean; itemsFetchedAndStored: number; error?: string }> {
  console.log(`[Reddit API Service] refreshUserRedditData: Starting refresh for userID: ${userId}, Keywords: "${userKeywords.join('", "')}"`);
  
  const testDocRef = doc(db, 'users', 'connectivity-test-doc-do-not-create');
  try {
    console.log("[Reddit API Service] refreshUserRedditData: Performing Firebase connectivity check...");
    await getDoc(testDocRef); 
    console.log("[Reddit API Service] refreshUserRedditData: Firebase connectivity check successful.");
  } catch (fbError) {
    const fbErrorMessage = fbError instanceof Error ? fbError.message : 'Unknown Firestore communication error.';
    console.error(`[Reddit API Service] refreshUserRedditData: Firebase connectivity check FAILED. Error: ${fbErrorMessage}`, fbError);
    return { success: false, itemsFetchedAndStored: 0, error: `Firebase Connection/Permission Error: ${fbErrorMessage}. Reddit sync aborted.` };
  }

  if (!userKeywords || userKeywords.length === 0) {
    console.log("[Reddit API Service] refreshUserRedditData: No keywords. Refresh aborted.");
    return { success: true, itemsFetchedAndStored: 0, error: "No keywords assigned." };
  }

  const authDetails = await getRedditAccessToken();
  if ('error' in authDetails) {
    console.error(`[Reddit API Service] refreshUserRedditData: Reddit Auth Failed: ${authDetails.error}`);
    return { success: false, itemsFetchedAndStored: 0, error: `Reddit Authentication Failed: ${authDetails.error}` };
  }
  const { token, userAgent } = authDetails;
  console.log("[Reddit API Service] refreshUserRedditData: Reddit token obtained.");

  const queryString = userKeywords.map(kw => `"${kw}"`).join(' OR ');
  const limit = 100; // Fetch up to 100 posts
  const sort = 'new';
  
  const searchUrl = `https://oauth.reddit.com/search.json?q=${encodeURIComponent(queryString)}&limit=${limit}&sort=${sort}&type=t3&restrict_sr=false&include_over_18=on`;

  console.log(`[Reddit API Service] refreshUserRedditData: Searching Reddit. Query: "${queryString}". URL: ${searchUrl}`);
  const fetchedItemsToStore: RedditPost[] = [];
  const fetchSinceTimestamp = Date.now() - (FETCH_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const processedAt = new Date().toISOString();

  try {
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Status: ${response.status}`);
      console.error(`[Reddit API Service] refreshUserRedditData: Reddit API Search Failed (${response.status}). Query: "${queryString}". Details: ${errorText}`);
      return { success: false, itemsFetchedAndStored: 0, error: `Reddit API Search Failed (${response.status}). Check server logs.` };
    }

    const responseData: RedditApiResponse = await response.json();
    const rawItems = (responseData.data?.children || []).filter(child => {
        const postData = child.data as RedditApiItemData;
        const postTimestampMs = new Date((postData.created_utc || 0) * 1000).getTime();
        return child.kind === 't3' && child.data && typeof child.data === 'object' && 'title' in child.data && postTimestampMs >= fetchSinceTimestamp;
    });
    console.log(`[Reddit API Service] refreshUserRedditData: Received ${rawItems.length} raw posts matching time filter.`);


    for (const child of rawItems) {
      const postData = child.data as RedditApiItemData;
      const postTimestampMs = new Date((postData.created_utc || 0) * 1000).getTime();
      
      let postSentimentResult = { sentiment: 'neutral' as RedditPost['sentiment'], error: undefined as string | undefined };
      const postSentimentText = `${postData.title || ''} ${postData.selftext || ''}`;
      
      if (postSentimentText.trim()) {
          const sentimentAnalysisInput: AdvancedSentimentInput = { text: postSentimentText };
          console.log(`[Reddit API Service] POST: Preparing to analyze sentiment for post ID: ${postData.id}, Text (first 30): "${postSentimentText.substring(0,30)}..."`);
          await delay(API_CALL_DELAY_MS); // Add delay here
          postSentimentResult = await analyzeAdvancedSentiment(sentimentAnalysisInput);
          console.log(`[Reddit API Service] POST: Sentiment analysis COMPLETE for post ID: ${postData.id}. Raw Result: ${JSON.stringify(postSentimentResult)}`);
      }
      
      let finalPostSentiment = postSentimentResult.sentiment;
      if (postSentimentResult.error) {
          console.warn(`[Reddit API Service] Advanced sentiment analysis failed for post ${postData.id}: ${postSentimentResult.error}. Defaulting to 'unknown'.`);
          finalPostSentiment = 'unknown';
      }
      
      const matchedKw = userKeywords.find(kw =>
            (postData.title?.toLowerCase().includes(kw.toLowerCase()) ||
             postData.selftext?.toLowerCase().includes(kw.toLowerCase()))
        ) || userKeywords[0] || 'general';
      
      const flairValue = postData.link_flair_text === undefined ? null : postData.link_flair_text;

      fetchedItemsToStore.push({
        id: postData.name,
        title: postData.title || 'No Title',
        content: postData.selftext || '',
        subreddit: postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
        author: postData.author || '[deleted]',
        timestamp: new Date(postTimestampMs).toISOString(),
        score: postData.score || 0,
        numComments: postData.num_comments || 0,
        url: (postData.url && postData.url.startsWith('http')) ? postData.url : `https://www.reddit.com${postData.permalink}`,
        flair: flairValue,
        type: 'Post',
        sentiment: finalPostSentiment,
        matchedKeyword: matchedKw,
        processedAt: processedAt,
      });

      if (postData.num_comments && postData.num_comments > 0 && fetchedItemsToStore.length < (limit * 1.5)) { 
        const commentsForThisPost = await fetchCommentsForPostInternal(
            postData.name, 
            postData.title || 'No Title',
            postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
            token,
            userAgent,
            userKeywords, 
            fetchSinceTimestamp,
            processedAt
        );
        fetchedItemsToStore.push(...commentsForThisPost);
      }
    }
    console.log(`[Reddit API Service] refreshUserRedditData: Processed ${fetchedItemsToStore.length} total items for storage.`);

    const itemsSubcollectionRef = collection(db, 'reddit_data', userId, 'fetched_items');

    if (fetchedItemsToStore.length > 0) {
        console.log(`[Reddit API Service] refreshUserRedditData: Batch writing ${fetchedItemsToStore.length} items for user ${userId}.`);
        try {
            const batch = writeBatch(db);
            fetchedItemsToStore.forEach(item => {
                const docId = item.id.includes('_') ? item.id.split('_')[1] : item.id; 
                if (!docId) {
                    console.warn("[Reddit API Service] refreshUserRedditData: Invalid ID for Firestore doc:", item.id);
                    return; 
                }
                const itemRef = doc(itemsSubcollectionRef, docId);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { sno, ...restOfItem } = item; 
                
                const itemToSaveClean = {
                  ...restOfItem,
                  flair: restOfItem.flair === undefined ? null : restOfItem.flair,
                  content: restOfItem.content === undefined || restOfItem.content === null ? '' : restOfItem.content,
                };
                batch.set(itemRef, { ...itemToSaveClean, serverTimestamp: firestoreServerTimestamp() });
            });
            await batch.commit();
            console.log(`[Reddit API Service] refreshUserRedditData: Stored ${fetchedItemsToStore.length} items for user ${userId}.`);
        } catch (writeError) {
            console.error(`[Reddit API Service] refreshUserRedditData: Firestore Write Failed for user ${userId}:`, writeError);
            const errorMessage = writeError instanceof Error ? writeError.message : 'Unknown Firestore write error.';
            return { success: false, itemsFetchedAndStored: 0, error: `Firestore Write Failed: ${errorMessage}` };
        }
    } else {
        console.log(`[Reddit API Service] refreshUserRedditData: No new items to store for user ${userId}.`);
    }

    console.log(`[Reddit API Service] refreshUserRedditData: Refresh completed for user ${userId}. Items processed this run: ${fetchedItemsToStore.length}.`);
    return { success: true, itemsFetchedAndStored: fetchedItemsToStore.length };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error.';
    console.error(`[Reddit API Service] refreshUserRedditData: General Exception for user "${userId}". Error: ${errorMessage}`, error);
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
    console.warn('[Reddit API Service] getStoredRedditFeedForUser: No userId.');
    return [];
  }
  console.log(`[Reddit API Service] getStoredRedditFeedForUser: Fetching stored items for user ${userId}.`);
  try {
    const itemsCollectionRef = collection(db, 'reddit_data', userId, 'fetched_items');
    const q = query(itemsCollectionRef, orderBy('timestamp', 'desc')); 
    const querySnapshot = await getDocs(q);

    const posts = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { serverTimestamp, sno, ...restOfData } = data; 
      return {
        id: docSnap.id, 
        ...restOfData,
        timestamp: restOfData.timestamp || new Date(0).toISOString(), 
        flair: restOfData.flair === undefined ? null : restOfData.flair, 
        content: restOfData.content === undefined || restOfData.content === null ? '' : restOfData.content, 
      } as RedditPost;
    });
    
    console.log(`[Reddit API Service] getStoredRedditFeedForUser: Fetched ${posts.length} items for user ${userId}.`);
    return posts;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching stored feed.';
    console.error(`[Reddit API Service] getStoredRedditFeedForUser: Error for user ${userId}: ${errorMessage}`, error);
    return [];
  }
}

