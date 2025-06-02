
'use server';

import type { RedditPost, RedditSearchParams as ClientRedditSearchParams } from '@/types';
import { getApiKeys } from './api-key-service';
import Sentiment from 'sentiment';
import { db } from './firebase'; // Firestore instance
import { collection, query, where, getDocs, writeBatch, orderBy, limit, startAfter, doc, getDoc, collectionGroup, deleteDoc } from 'firebase/firestore';

const REDDIT_CLIENT_ID_SERVICE_NAME = "Reddit Client ID";
const REDDIT_CLIENT_SECRET_SERVICE_NAME = "Reddit Client Secret";
const REDDIT_USER_AGENT_SERVICE_NAME = "Reddit User Agent";

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

const sentimentAnalyzer = new Sentiment();

const CUTOFF_DATE_STRING = '2025-06-01T00:00:00.000Z';
const CUTOFF_TIMESTAMP = new Date(CUTOFF_DATE_STRING).getTime();

const COMMENTS_PER_POST_LIMIT = 10;
const COMMENT_FETCH_DEPTH = 1;
const POSTS_PER_PAGE_LIMIT = 25; // How many posts to fetch from Reddit API in one go for the /search endpoint

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
    
    const commentsListing = responseData[1];
    const rawCommentItems = commentsListing?.data?.children || [];
    
    const mappedComments: RedditPost[] = [];
    for (const child of rawCommentItems) {
      if (child.kind === 't1' && child.data && typeof child.data === 'object' && 'body' in child.data) {
        const commentData = child.data as RedditApiItemData;
        const sentimentResult = sentimentAnalyzer.analyze(commentData.body || '');
        let sentiment: RedditPost['sentiment'] = 'neutral';
        if (sentimentResult.score > 0.5) sentiment = 'positive';
        else if (sentimentResult.score < -0.5) sentiment = 'negative';

        mappedComments.push({
          id: commentData.name,
          title: postTitle,
          content: commentData.body || '',
          subreddit: postSubredditPrefixed,
          author: commentData.author || '[deleted]',
          timestamp: new Date((commentData.created_utc || 0) * 1000).toISOString(),
          score: commentData.score || 0,
          numComments: 0, 
          url: `https://www.reddit.com${commentData.permalink}`,
          flair: undefined,
          sentiment: sentiment,
          type: 'Comment',
          processedAt: new Date().toISOString(), // Add processedAt here
        });
      }
    }
    return mappedComments;

  } catch (error) {
    console.error(`[Reddit API Service] Exception fetching/processing comments for post ${postId}:`, error);
    return [];
  }
}

async function _fetchRawRedditDataBatch(
    queryKeywords: string[],
    token: string,
    userAgent: string,
    afterCursor: string | null = null
): Promise<{ items: RedditPost[], nextRedditCursor: string | null, error?: string }> {
    const q = queryKeywords.join(' OR ');
    let postSearchUrl = `https://oauth.reddit.com/search.json?q=${encodeURIComponent(q)}&limit=${POSTS_PER_PAGE_LIMIT}&sort=new&t=all&type=t3&restrict_sr=false&include_over_18=on`;
    if (afterCursor) {
        postSearchUrl += `&after=${afterCursor}`;
    }

    console.log(`[Reddit API Service] _fetchRawRedditDataBatch: Fetching POSTS for query '${q}' (limit ${POSTS_PER_PAGE_LIMIT}, after: ${afterCursor || 'none'})`);

    try {
        const postResponse = await fetch(postSearchUrl, {
            headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
        });

        if (!postResponse.ok) {
            const errorText = await postResponse.text().catch(() => `Status: ${postResponse.status}`);
            console.error(`[Reddit API Service] Error fetching posts from Reddit (${postResponse.status}): ${errorText}`);
            return { items: [], nextRedditCursor: null, error: `Reddit API Error for posts (${postResponse.status}).` };
        }

        const rawPostResponseData: RedditApiResponse = await postResponse.json();
        const rawPostItems = rawPostResponseData.data?.children || [];
        
        const allFetchedItems: RedditPost[] = [];

        for (const child of rawPostItems) {
            if (child.kind === 't3' && child.data && typeof child.data === 'object' && 'title' in child.data) {
                const postData = child.data as RedditApiItemData;
                
                const mappedPost: RedditPost = {
                    id: postData.name,
                    title: postData.title || 'No Title',
                    content: postData.selftext || '',
                    subreddit: postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
                    author: postData.author || '[deleted]',
                    timestamp: new Date((postData.created_utc || 0) * 1000).toISOString(),
                    score: postData.score || 0,
                    numComments: postData.num_comments || 0,
                    url: (postData.url && postData.url.startsWith('http')) ? postData.url : `https://www.reddit.com${postData.permalink}`,
                    flair: postData.link_flair_text || undefined,
                    type: 'Post',
                    // Sentiment and processedAt will be added in fetchAndStoreRedditDataForUser
                };
                allFetchedItems.push(mappedPost);

                const commentsForThisPost = await fetchCommentsForPost(
                    postData.name,
                    postData.title || 'No Title',
                    postData.subreddit_name_prefixed || `r/${postData.subreddit}` || 'N/A',
                    token,
                    userAgent
                );
                allFetchedItems.push(...commentsForThisPost);
            }
        }
        return { items: allFetchedItems, nextRedditCursor: rawPostResponseData.data?.after || null };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error.';
        console.error(`[Reddit API Service] Exception during _fetchRawRedditDataBatch:`, error);
        return { items: [], nextRedditCursor: null, error: `Network or processing error in _fetchRawRedditDataBatch: ${errorMessage}` };
    }
}

export async function fetchAndStoreRedditDataForUser(userId: string, keywords: string[]): Promise<{ success: boolean; count: number; error?: string }> {
    if (!userId || !keywords || keywords.length === 0) {
        return { success: false, count: 0, error: "User ID and keywords are required." };
    }

    const token = await getRedditAccessToken();
    if (!token) {
        return { success: false, count: 0, error: "Failed to authenticate with Reddit. Check API Key Management." };
    }

    const apiKeys = await getApiKeys();
    const userAgentEntry = apiKeys.find(k => k.serviceName === REDDIT_USER_AGENT_SERVICE_NAME);
    const userAgent = userAgentEntry ? userAgentEntry.keyValue : "InsightStreamApp/1.0 (FallbackUserAgent)";
     if (!userAgentEntry) {
        console.warn(`[Reddit API Service] Warning: '${REDDIT_USER_AGENT_SERVICE_NAME}' not found. Using fallback.`);
    }

    // Clear existing data for the user
    const userFeedCollectionRef = collection(db, 'reddit_data', userId, 'fetched_items');
    try {
        const existingDocsSnapshot = await getDocs(userFeedCollectionRef);
        if (!existingDocsSnapshot.empty) {
            const deleteBatch = writeBatch(db);
            existingDocsSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
            await deleteBatch.commit();
            console.log(`[Reddit API Service] Cleared ${existingDocsSnapshot.size} old items for user ${userId}.`);
        }
    } catch (e) {
        console.error(`[Reddit API Service] Error clearing old data for user ${userId}:`, e);
        // Decide if this is a fatal error or if we can proceed
    }
    
    // For now, let's fetch only one batch of posts from Reddit to keep it simple and avoid too many API calls during a single refresh.
    // Reddit's search can be broad, so a single batch (POSTS_PER_PAGE_LIMIT posts + their comments) can already be a lot.
    const { items: rawItems, error: fetchError } = await _fetchRawRedditDataBatch(keywords, token, userAgent, null);

    if (fetchError) {
        return { success: false, count: 0, error: fetchError };
    }

    // Process and store
    const processedItems: RedditPost[] = [];
    rawItems.forEach(item => {
        const itemDate = new Date(item.timestamp);
        const itemNumericTimestamp = itemDate.getTime();
        if (itemNumericTimestamp >= CUTOFF_TIMESTAMP) {
            let sentimentText = '';
            if (item.type === 'Post') {
                sentimentText = `${item.title || ''} ${item.content || ''}`;
            } else if (item.type === 'Comment') {
                sentimentText = item.content || '';
            }
            const sentimentResult = sentimentAnalyzer.analyze(sentimentText);
            let finalSentiment: RedditPost['sentiment'] = 'neutral';
            if (sentimentResult.score > 0.5) finalSentiment = 'positive';
            else if (sentimentResult.score < -0.5) finalSentiment = 'negative';

            processedItems.push({
                ...item,
                sentiment: finalSentiment,
                processedAt: new Date().toISOString(),
                matchedKeyword: keywords.find(kw => 
                    (item.title?.toLowerCase().includes(kw.toLowerCase()) || 
                     item.content?.toLowerCase().includes(kw.toLowerCase()))
                ) || keywords[0] // Fallback to first keyword if no direct match
            });
        }
    });
    
    if (processedItems.length === 0) {
        console.log(`[Reddit API Service] No items for user ${userId} after filtering and processing for keywords: ${keywords.join(', ')}.`);
        return { success: true, count: 0 };
    }

    const batch = writeBatch(db);
    processedItems.forEach(item => {
        const docRef = doc(userFeedCollectionRef, item.id); // Use Reddit item's fullname as doc ID
        batch.set(docRef, item);
    });

    try {
        await batch.commit();
        console.log(`[Reddit API Service] Successfully stored ${processedItems.length} items for user ${userId}.`);
        return { success: true, count: processedItems.length };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown Firestore error.';
        console.error(`[Reddit API Service] Error storing items for user ${userId}:`, e);
        return { success: false, count: 0, error: `Failed to store data: ${errorMessage}` };
    }
}

export async function getStoredRedditFeedForUser(
  userId: string,
  paginationOptions: { limitNum?: number; startAfterDocId?: string } = {}
): Promise<{ data: RedditPost[]; lastDocId: string | null; error?: string }> {
  if (!userId) {
    return { data: [], lastDocId: null, error: "User ID is required." };
  }

  const userFeedCollectionRef = collection(db, 'reddit_data', userId, 'fetched_items');
  const { limitNum = 20, startAfterDocId } = paginationOptions;

  let q = query(userFeedCollectionRef, orderBy('timestamp', 'desc'), limit(limitNum));

  if (startAfterDocId) {
    try {
      const startAfterDocSnap = await getDoc(doc(userFeedCollectionRef, startAfterDocId));
      if (startAfterDocSnap.exists()) {
        q = query(userFeedCollectionRef, orderBy('timestamp', 'desc'), startAfter(startAfterDocSnap), limit(limitNum));
      } else {
        console.warn(`[Reddit API Service] startAfterDocId ${startAfterDocId} not found for user ${userId}. Fetching from beginning.`);
      }
    } catch (e) {
        console.error(`[Reddit API Service] Error fetching startAfterDoc for pagination (user ${userId}, docId ${startAfterDocId}):`, e);
        return { data: [], lastDocId: null, error: "Error with pagination cursor." };
    }
  }

  try {
    const querySnapshot = await getDocs(q);
    const posts = querySnapshot.docs.map(docSnap => docSnap.data() as RedditPost);
    const lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
    const newLastDocId = lastVisibleDoc ? lastVisibleDoc.id : null;
    
    console.log(`[Reddit API Service] getStoredRedditFeedForUser (user ${userId}): Fetched ${posts.length} items. Next cursor (docId): ${newLastDocId}. limitNum: ${limitNum}, startAfterDocId: ${startAfterDocId || 'none'}`);
    return { data: posts, lastDocId: newLastDocId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Firestore query error.';
    console.error(`[Reddit API Service] Error fetching stored feed for user ${userId}:`, error);
    return { data: [], lastDocId: null, error: `Failed to fetch stored feed: ${errorMessage}` };
  }
}
