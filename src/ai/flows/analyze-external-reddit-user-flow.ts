
'use server';
/**
 * @fileOverview A Genkit flow to analyze an external Reddit user's profile and recent activity,
 * and save the analysis to Firestore under the app user's profile.
 *
 * - analyzeExternalRedditUser - Main flow function.
 * - ExternalRedditUserAnalysisInput - Input type for the flow.
 * - ExternalRedditUserAnalysis - Output type for the flow.
 * - ExternalRedditUserDataItem - Type for individual post/comment items.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getRedditAccessToken } from '@/lib/reddit-api-service';
import type { ExternalRedditUserAnalysis, ExternalRedditUserDataItem, ExternalRedditUserAnalysisInput } from '@/types';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const API_CALL_TIMEOUT_MS = 15000; // Timeout for external Reddit API calls
const MAX_ITEMS_PER_FETCH = 25; // Max posts or comments to fetch per user

interface RedditApiUserAboutData {
  kind: string;
  data: {
    name: string;
    created_utc: number;
    link_karma: number;
    comment_karma: number;
    icon_img?: string;
  };
}

interface RedditApiItemData {
  id: string;
  name: string; // Fullname, e.g., t3_xxxxxx
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
  subreddit: string; // Just the name, e.g., "pics"
  subreddit_name_prefixed: string; // e.g., "r/pics"
  title?: string; // For submissions
  body?: string; // For comments
  body_html?: string; // For comments, might be useful for display
  num_comments?: number; // For submissions
  url?: string; // For submissions, often the direct link to content or self.Reddit post
  is_self?: boolean; // For submissions, if it's a self-post
  link_title?: string; // For comments, title of the post they are on
  link_url?: string; // For comments, URL of the post they are on
  link_author?: string; // For comments, author of the post they are on
  parent_id?: string; // For comments, fullname of parent (can be t3_ or t1_)
}

interface RedditApiChild {
  kind: 't1' | 't3' | 'more'; // t1 for comment, t3 for submission
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


const analyzeExternalRedditUserFlow = ai.defineFlow(
  {
    name: 'analyzeExternalRedditUserFlow',
    inputSchema: z.custom<ExternalRedditUserAnalysisInput>(), // Use custom to match the complex input type
    outputSchema: z.custom<ExternalRedditUserAnalysis>(), // Using custom to match the complex type
  },
  // This is the main invoke function of the flow
  // It's wrapped in a try-catch block to handle potential errors during analysis
  // and save the suspension status if necessary.
  // Note: The outer exported function analyzeExternalRedditUser also has a try-catch
  async (input): Promise<ExternalRedditUserAnalysis> => {
    console.log(`[AnalyzeExternalRedditUserFlow] Initiating analysis for u/${input.username}. App User ID: ${input.appUserId || 'N/A'}`);
    const authDetails = await getRedditAccessToken();
    if ('error' in authDetails) {
      console.error(`[AnalyzeExternalRedditUserFlow] Reddit Auth Failed for u/${input.username}: ${authDetails.error}`);
      throw new Error(`Reddit Authentication Failed: ${authDetails.error}`);
    }
    const { token, userAgent } = authDetails;
    console.log(`[AnalyzeExternalRedditUserFlow] Reddit token obtained for u/${input.username}. User Agent: ${userAgent}`);

    const result: ExternalRedditUserAnalysis = {
      username: input.username,
      accountCreated: null,
      totalPostKarma: 0,
      totalCommentKarma: 0,
      subredditsPostedIn: [],
      totalPostsFetchedThisRun: 0,
      totalCommentsFetchedThisRun: 0,
      fetchedPostsDetails: [],
      fetchedCommentsDetails: [],
      // lastRefreshedAt will be set before saving and returning
    };

    const uniqueSubreddits = new Set<string>();

    // Outer try-catch to catch any unhandled errors in the flow
    try {
      // 1. Fetch user "about" info
      console.log(`[AnalyzeExternalRedditUserFlow] Starting try block for u/${input.username}`);
      const aboutUrl = `https://oauth.reddit.com/user/${input.username}/about.json`;
      console.log(`[AnalyzeExternalRedditUserFlow] Fetching 'about' info for u/${input.username} from ${aboutUrl}`);
      const aboutResponse = await fetch(aboutUrl, {
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
        signal: AbortSignal.timeout(API_CALL_TIMEOUT_MS),
      });
      if (!aboutResponse.ok) {
        const errorText = await aboutResponse.text().catch(() => `Status: ${aboutResponse.status}`);
        console.error(`[AnalyzeExternalRedditUserFlow] Error fetching 'about' for u/${input.username} (${aboutResponse.status}): ${errorText}`);
        throw new Error(`Failed to fetch user details for u/${input.username} (${aboutResponse.status})`);
      }
      const aboutData: RedditApiUserAboutData = await aboutResponse.json();
      if (aboutData && aboutData.data) {
        result.accountCreated = new Date(aboutData.data.created_utc * 1000).toISOString();
        result.totalPostKarma = aboutData.data.link_karma || 0;
        result.totalCommentKarma = aboutData.data.comment_karma || 0;
         console.log(`[AnalyzeExternalRedditUserFlow] 'About' info for u/${input.username}: Created: ${result.accountCreated}, Post Karma: ${result.totalPostKarma}, Comment Karma: ${result.totalCommentKarma}`);
      } else {
        console.warn(`[AnalyzeExternalRedditUserFlow] No 'about' data found for u/${input.username}. Response: ${JSON.stringify(aboutData).substring(0,100)}`);
      }

      // 2. Fetch user submissions (posts)
      const postsUrl = `https://oauth.reddit.com/user/${input.username}/submitted.json?sort=new&limit=${MAX_ITEMS_PER_FETCH}`;
      console.log(`[AnalyzeExternalRedditUserFlow] Fetching posts for u/${input.username} from ${postsUrl}`);
      const postsResponse = await fetch(postsUrl, {
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
        signal: AbortSignal.timeout(API_CALL_TIMEOUT_MS),
      });
      if (postsResponse.ok) {
        const postsData: RedditApiResponse = await postsResponse.json();
        result.totalPostsFetchedThisRun = postsData.data?.children?.filter(c => c.kind === 't3').length || 0;
        console.log(`[AnalyzeExternalRedditUserFlow] Fetched ${result.totalPostsFetchedThisRun} raw post items for u/${input.username}.`);
        postsData.data?.children?.forEach(child => {
          if (child.kind === 't3') { // t3 is a Link (submission)
            const post = child.data as RedditApiItemData;
            result.fetchedPostsDetails.push({
              id: post.id,
              titleOrContent: post.title || 'No Title',
              subreddit: post.subreddit_name_prefixed || `r/${post.subreddit}` || 'N/A',
              timestamp: new Date(post.created_utc * 1000).toISOString(),
              score: post.score || 0,
              numComments: post.num_comments || 0,
              url: post.permalink ? `https://www.reddit.com${post.permalink}` : (post.url || '#'),
              type: 'Post',
            });
            if(post.subreddit) uniqueSubreddits.add(post.subreddit_name_prefixed || `r/${post.subreddit}`);
          }
        });
        console.log(`[AnalyzeExternalRedditUserFlow] Mapped ${result.fetchedPostsDetails.length} posts for u/${input.username}.`);
      } else {
        const errorTextPosts = await postsResponse.text().catch(() => `Posts fetch status: ${postsResponse.status}`);
        console.warn(`[AnalyzeExternalRedditUserFlow] Failed to fetch posts for u/${input.username} (${postsResponse.status}): ${errorTextPosts.substring(0,200)}`);
      }

      // 3. Fetch user comments
      const commentsUrl = `https://oauth.reddit.com/user/${input.username}/comments.json?sort=new&limit=${MAX_ITEMS_PER_FETCH}`;
      console.log(`[AnalyzeExternalRedditUserFlow] Fetching comments for u/${input.username} from ${commentsUrl}`);
      const commentsResponse = await fetch(commentsUrl, {
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': userAgent },
        signal: AbortSignal.timeout(API_CALL_TIMEOUT_MS),
      });
      if (commentsResponse.ok) {
        const commentsData: RedditApiResponse = await commentsResponse.json();
        result.totalCommentsFetchedThisRun = commentsData.data?.children?.filter(c => c.kind === 't1').length || 0;
        console.log(`[AnalyzeExternalRedditUserFlow] Fetched ${result.totalCommentsFetchedThisRun} raw comment items for u/${input.username}.`);
        commentsData.data?.children?.forEach(child => {
          if (child.kind === 't1') { // t1 is a Comment
            const comment = child.data as RedditApiItemData;
            result.fetchedCommentsDetails.push({
              id: comment.id,
              titleOrContent: comment.body || 'No Comment Text',
              subreddit: comment.subreddit_name_prefixed || `r/${comment.subreddit}` || 'N/A',
              timestamp: new Date(comment.created_utc * 1000).toISOString(),
              score: comment.score || 0,
              url: comment.permalink ? `https://www.reddit.com${comment.permalink}` : (comment.link_url || '#'),
              type: 'Comment',
            });
             if(comment.subreddit) uniqueSubreddits.add(comment.subreddit_name_prefixed || `r/${comment.subreddit}`);
          }
        });
        console.log(`[AnalyzeExternalRedditUserFlow] Mapped ${result.fetchedCommentsDetails.length} comments for u/${input.username}.`);
      } else {
        const errorTextComments = await commentsResponse.text().catch(() => `Comments fetch status: ${commentsResponse.status}`);
 console.warn(`[AnalyzeExternalRedditUserFlow] Failed to fetch comments for u/${input.username} (${commentsResponse.status}): ${errorTextComments.substring(0, 200)}`);
      }

      result.subredditsPostedIn = Array.from(uniqueSubreddits);
      // Save analysis to Firestore
      // This save operation has its own try-catch because a failure here shouldn't necessarily
      // mark the account as suspended, but should still report an error.
      if (input.appUserId && input.username) {
        // Ensure the _placeholder field is removed or set to false upon successful analysis
        const dataToSave: ExternalRedditUserAnalysis = { ...result, _placeholder: false };
        const firestorePath = `users/${input.appUserId}/redditAnalyses/${input.username}`;
        const analysisDocRef = doc(db, firestorePath);
        try { // This inner try-catch is specifically for the Firestore save operation
          await setDoc(analysisDocRef, dataToSave, { merge: true });
          console.log(`[AnalyzeExternalRedditUserFlow] Successfully saved analysis for u/${input.username} to Firestore at ${firestorePath}`);
        } catch (firestoreError) {
          const saveErrorMessage = firestoreError instanceof Error ? firestoreError.message : 'Unknown Firestore save error.';
          console.error(`[AnalyzeExternalRedditUserFlow] Failed to save analysis for u/${input.username} to Firestore:`, firestoreError);
          // Throw an error here so the client knows the save failed and the entire operation is reported as an error.
          throw new Error(`Failed to save analysis to database for u/${input.username}: ${saveErrorMessage}`);
        }
      } else {
        console.log(`[AnalyzeExternalRedditUserFlow] appUserId not provided or username missing, skipping Firestore save for u/${input.username}.`);
      }

      result.lastRefreshedAt = new Date().toISOString(); // Set the refresh timestamp
      console.log(`[AnalyzeExternalRedditUserFlow] Analysis completed successfully for u/${input.username}. Last refreshed: ${result.lastRefreshedAt}`);
      return result;

    } catch (error) {
      // This catch block handles errors during the core analysis logic
      console.error(`[AnalyzeExternalRedditUserFlow] Exception caught in try block for u/${input.username}:`, error);
      // This check is now within the try-catch that wraps the API calls and initial processing.


      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during analysis.';
      console.error(`[AnalyzeExternalRedditUserFlow] Exception during analysis for u/${input.username}: ${errorMessage}`, error);

      // Check if the error indicates a suspended account or analysis failure
      // Added explicit check for the "Invalid time value" as requested
      // This catch block is intended to handle errors during the core analysis logic
      // and save suspension status if the error is indicative of a suspended account.
      if (errorMessage.includes('Invalid time value') ||
        errorMessage.includes('Failed to fetch user details') ||
        errorMessage.includes('user not found or suspended') ||
        errorMessage.includes('Request timed out')) { // Added timeout as well
        console.log(`[AnalyzeExternalRedditUserFlow] Detected likely suspended or inaccessible account or transient error for u/${input.username}. Attempting to update Firestore.`);
        if (input.appUserId && input.username) {
          const firestorePath = `users/${input.appUserId}/redditAnalyses/${input.username}`;
          const analysisDocRef = doc(db, firestorePath);
          try {
            await setDoc(analysisDocRef, {
              username: input.username, // Ensure username is included
              suspensionStatus: "This account has been suspended", // Set suspension status here
              lastAttemptedRefresh: new Date().toISOString(), // Record when the attempt was made
              error: errorMessage // Include the specific error message
            }, { merge: true });
            console.log(`[AnalyzeExternalRedditUserFlow] Successfully updated Firestore with suspension status for u/${input.username} at ${firestorePath}`);
          } catch (firestoreError) {
            console.error(`[AnalyzeExternalRedditUserFlow] Failed to save suspension status to Firestore for u/${input.username}:`, firestoreError);
          }
        }
      }

      // Re-throw the error so the client-side knows the flow failed critically
      throw new Error(`Analysis failed for u/${input.username}: ${errorMessage}`);

    }
  }
);

export async function analyzeExternalRedditUser(input: ExternalRedditUserAnalysisInput): Promise<ExternalRedditUserAnalysis> {
  try {
    console.log(`[analyzeExternalRedditUser EXPORTED WRAPPER] Called for username u/${input.username}, appUser ${input.appUserId}. Forwarding to flow runner.`);
    if (!input.username || typeof input.username !== 'string' || input.username.trim() === "") {
        const errorMsg = `Invalid or missing username: '${input.username}'.`;
        console.error(`[analyzeExternalRedditUser EXPORTED WRAPPER] ${errorMsg} Aborting flow call.`);
        return {
            username: input.username || "unknown",
            error: errorMsg,
            accountCreated: null, totalPostKarma: 0, totalCommentKarma: 0, subredditsPostedIn: [],
            totalPostsFetchedThisRun: 0, totalCommentsFetchedThisRun: 0,
            fetchedPostsDetails: [], fetchedCommentsDetails: [], lastRefreshedAt: null, _placeholder: true
        };
    }
    const result = await analyzeExternalRedditUserFlow(input);
    console.log(`[analyzeExternalRedditUser EXPORTED WRAPPER] Flow runner completed for u/${input.username}.`);
    return result;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred in the analyzeExternalRedditUser flow runner.";
    console.error(`[analyzeExternalRedditUser EXPORTED WRAPPER] Unhandled exception from flow runner for u/${input.username}: ${errorMessage}`, e);
    return {
        username: input.username,
        error: `Critical flow error for u/${input.username}: ${errorMessage}. Check server logs.`,
        accountCreated: null, totalPostKarma: 0, totalCommentKarma: 0, subredditsPostedIn: [],
        totalPostsFetchedThisRun: 0, totalCommentsFetchedThisRun: 0,
        fetchedPostsDetails: [], fetchedCommentsDetails: [], lastRefreshedAt: null, _placeholder: true
    };
  }
}
// Helper types for Reddit API responses
interface RedditApiListing {
  kind: string;
  data: {
    children: Array<{ data: any }>;
    after: string | null;
    before: string | null;
  };
}
