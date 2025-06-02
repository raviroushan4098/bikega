
'use server';

import { db } from './firebase';
import { collection, addDoc, getDocs, query, Timestamp, orderBy, doc, where } from 'firebase/firestore';
import type { YoutubeVideo } from '@/types';
import { getApiKeys } from './api-key-service';

const YOUTUBE_API_KEY_SERVICE_NAME = "YouTube Data API Key";

export interface StoredYoutubeVideoData {
  url: string;
  title: string;
  thumbnailUrl: string;
  dataAiHint?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  channelTitle: string;
  createdAt: Timestamp;
  fetchedFromApi: boolean;
  assignedToUserId: string;
}

function extractYouTubeVideoId(url: string): string | null {
  let videoId: string | null = null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      videoId = urlObj.searchParams.get('v');
    } else if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.substring(1);
    }
  } catch (e) {
    // Invalid URL, try regex
  }

  if (!videoId) {
    const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/;
    const match = url.match(regex);
    if (match && match[1]) {
      videoId = match[1];
    }
  }
  return videoId;
}

async function fetchVideoDetailsFromYouTubeAPI(videoId: string): Promise<Partial<StoredYoutubeVideoData> | null> {
  const apiKeys = await getApiKeys();
  const youtubeApiKeyEntry = apiKeys.find(k => k.serviceName === YOUTUBE_API_KEY_SERVICE_NAME);

  if (!youtubeApiKeyEntry || !youtubeApiKeyEntry.keyValue) {
    console.warn(`[youtube-video-service] '${YOUTUBE_API_KEY_SERVICE_NAME}' not found or empty in API Management. Cannot fetch video details from API.`);
    return null;
  }
  const apiKey = youtubeApiKeyEntry.keyValue;
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,statistics`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[youtube-video-service] YouTube API error (${response.status}):`, errorData.error?.message || response.statusText);
      return null;
    }
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      const snippet = item.snippet;
      const statistics = item.statistics;
      return {
        title: snippet.title || 'N/A',
        thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || 'https://placehold.co/320x180.png',
        channelTitle: snippet.channelTitle || 'N/A',
        likeCount: parseInt(statistics.likeCount, 10) || 0,
        commentCount: parseInt(statistics.commentCount, 10) || 0,
        shareCount: 0,
        dataAiHint: `youtube video ${snippet.title?.substring(0,20) || ''}`,
        fetchedFromApi: true,
      };
    }
    console.warn(`[youtube-video-service] Video ID '${videoId}' not found via YouTube API.`);
    return null;
  } catch (error) {
    console.error("[youtube-video-service] Error fetching from YouTube API: ", error);
    return null;
  }
}

export async function addYoutubeVideoToFirestore(
  videoUrl: string,
  assignedToUserId: string
): Promise<YoutubeVideo> {
  try {
    console.log(`[youtube-video-service] addYoutubeVideoToFirestore called. URL: '${videoUrl}', assignedToUserId: '${assignedToUserId}'`);

    if (!assignedToUserId) {
      throw new Error("assignedToUserId cannot be empty.");
    }

    const videoId = extractYouTubeVideoId(videoUrl);
    let videoDetails: Partial<StoredYoutubeVideoData> | null = null;

    if (videoId) {
      videoDetails = await fetchVideoDetailsFromYouTubeAPI(videoId);
    } else {
      console.warn(`[youtube-video-service] Could not extract Video ID from URL: ${videoUrl}. Using placeholders.`);
    }

    const createdAtTimestamp = Timestamp.now();

    const newVideoData: StoredYoutubeVideoData = {
      url: videoUrl,
      title: videoDetails?.title || `Video: ${videoUrl.substring(0, 40)}...`,
      thumbnailUrl: videoDetails?.thumbnailUrl || 'https://placehold.co/320x180.png',
      dataAiHint: videoDetails?.dataAiHint || 'video placeholder',
      likeCount: videoDetails?.likeCount || 0,
      commentCount: videoDetails?.commentCount || 0,
      shareCount: videoDetails?.shareCount || 0,
      channelTitle: videoDetails?.channelTitle || 'N/A',
      createdAt: createdAtTimestamp,
      fetchedFromApi: videoDetails?.fetchedFromApi || false,
      assignedToUserId: assignedToUserId,
    };

    const videosCollectionRef = collection(db, `youtube_videos`);
    const docRef = await addDoc(videosCollectionRef, newVideoData);

    console.log(`[youtube-video-service] Video added to Firestore at path: youtube_videos/${docRef.id}. Assigned to user: ${assignedToUserId}. Fetched from API: ${newVideoData.fetchedFromApi}`);

    return {
      id: docRef.id,
      ...newVideoData,
      createdAt: createdAtTimestamp.toDate().toISOString(),
    };

  } catch (error) {
    console.error("[youtube-video-service] Error adding YouTube video to Firestore: ", error);
    if (error instanceof Error) {
        throw new Error(`Failed to save video assignment: ${error.message}`);
    }
    throw new Error("Failed to save video assignment due to an unknown error.");
  }
}

/**
 * Fetches videos assigned to a specific user from Firestore.
 * This query requires a composite index on 'assignedToUserId' (ASC) and 'createdAt' (DESC).
 */
export async function getVideosForUserFromFirestore(userId: string): Promise<YoutubeVideo[]> {
  const videosCollectionRef = collection(db, 'youtube_videos');
  console.log(`[youtube-video-service] getVideosForUserFromFirestore: Querying for videos ASSIGNED TO USER ID: '${userId}'.`);
  
  const q = query(
    videosCollectionRef,
    where('assignedToUserId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const videos: YoutubeVideo[] = [];
  try {
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(docSnap => {
      try {
        const data = docSnap.data() as StoredYoutubeVideoData;
        if (!data.createdAt || typeof data.createdAt.toDate !== 'function') {
          console.warn(`[youtube-video-service][USER_FILTER] Video ID '${docSnap.id}' (User: ${userId}) has missing or invalid 'createdAt'. Skipping. Data:`, JSON.stringify(data));
          return;
        }
        if (!data.assignedToUserId) {
           console.warn(`[youtube-video-service][USER_FILTER] Video ID '${docSnap.id}' (User: ${userId}) is missing 'assignedToUserId'. Skipping. Data:`, JSON.stringify(data));
           return;
        }
        videos.push({
          id: docSnap.id,
          url: data.url,
          title: data.title || 'Untitled Video',
          thumbnailUrl: data.thumbnailUrl,
          dataAiHint: data.dataAiHint,
          likeCount: data.likeCount,
          commentCount: data.commentCount,
          shareCount: data.shareCount,
          channelTitle: data.channelTitle,
          assignedToUserId: data.assignedToUserId,
          createdAt: data.createdAt.toDate().toISOString(),
        });
      } catch (processError) {
        console.error(`[youtube-video-service][USER_FILTER] Error processing video ID '${docSnap.id}' (User: ${userId}):`, processError, "Problematic video data:", JSON.stringify(docSnap.data()));
      }
    });
    console.log(`[youtube-video-service] getVideosForUserFromFirestore: Found ${videos.length} videos for user '${userId}'.`);
    if (videos.length > 0) {
        console.log(`[youtube-video-service] First video for user '${userId}': `, {id: videos[0].id, title: videos[0].title ? videos[0].title.substring(0,30) : 'N/A', assignedTo: videos[0].assignedToUserId });
    }
    return videos;
  } catch (error) {
    console.error(`[youtube-video-service] getVideosForUserFromFirestore: Error fetching videos for user '${userId}': `, error);
    if (error instanceof Error && (error.message.includes('composite index') || error.message.includes('requires an index'))) {
        console.error(`[youtube-video-service] FIRESTORE INDEX REQUIRED for user query: The query for user '${userId}' needs a composite index.`);
        console.error(`  Go to your Firebase console -> Firestore Database -> Indexes.`);
        console.error(`  Create an index for the 'youtube_videos' collection with fields:`);
        console.error(`    1. 'assignedToUserId' (Ascending)`);
        console.error(`    2. 'createdAt' (Descending)`);
    }
    return [];
  }
}


/**
 * Fetches ALL videos from Firestore, typically for the "Show All Videos" admin view.
 * This function's behavior for "Show All" should remain consistent.
 */
export async function getYoutubeVideosFromFirestore(userIdForFilter?: string): Promise<YoutubeVideo[]> {
  const videosCollectionRef = collection(db, 'youtube_videos');
  
  // If this function is called with a specific user ID, log a warning and return empty.
  // The frontend should use `getVideosForUserFromFirestore` for specific users.
  if (userIdForFilter && userIdForFilter !== 'all') {
    console.warn(`[youtube-video-service] getYoutubeVideosFromFirestore was called with specific user ID '${userIdForFilter}'. This function is intended for 'all' videos. Use 'getVideosForUserFromFirestore' for specific user queries. Returning empty list.`);
    return [];
  }

  console.log(`[youtube-video-service] getYoutubeVideosFromFirestore: Querying for ALL videos from 'youtube_videos' collection (filter was '${userIdForFilter}', treated as 'all').`);
  const q = query(videosCollectionRef, orderBy('createdAt', 'desc'));
  
  const allVideos: YoutubeVideo[] = [];
  try {
    const querySnapshot = await getDocs(q);
    console.log(`[youtube-video-service][ALL_FILTER] Found ${querySnapshot.docs.length} total video document(s) in 'youtube_videos' collection.`);
    
    const docIds = querySnapshot.docs.map(doc => doc.id);
    if (docIds.length > 0) {
      console.log(`[youtube-video-service][ALL_FILTER] IDs of video documents found in 'youtube_videos' collection: ${docIds.join(', ')}`);
    }

    querySnapshot.forEach(docSnap => {
      try {
        const data = docSnap.data() as StoredYoutubeVideoData;
        if (!data.createdAt || typeof data.createdAt.toDate !== 'function') {
          console.warn(`[youtube-video-service][ALL_FILTER] Video ID '${docSnap.id}' has missing or invalid 'createdAt' field. Skipping this video. Data:`, JSON.stringify(data));
          return;
        }
        if (!data.assignedToUserId) {
           console.warn(`[youtube-video-service][ALL_FILTER] Video ID '${docSnap.id}' is missing 'assignedToUserId'. Skipping. Data:`, JSON.stringify(data));
           return;
        }
        allVideos.push({
          id: docSnap.id,
          url: data.url,
          title: data.title || 'Untitled Video',
          thumbnailUrl: data.thumbnailUrl,
          dataAiHint: data.dataAiHint,
          likeCount: data.likeCount,
          commentCount: data.commentCount,
          shareCount: data.shareCount,
          channelTitle: data.channelTitle,
          assignedToUserId: data.assignedToUserId,
          createdAt: data.createdAt.toDate().toISOString(),
        });
      } catch (processError) {
        console.error(`[youtube-video-service][ALL_FILTER] Error processing video ID '${docSnap.id}':`, processError, "Problematic video data:", JSON.stringify(docSnap.data()));
      }
    });

    console.log(`[youtube-video-service][ALL_FILTER] Aggregated ${allVideos.length} videos in total for ALL users.`);
    if (allVideos.length > 0) {
        console.log(`[youtube-video-service][ALL_FILTER] First video in 'all' view: `, {id: allVideos[0].id, title: allVideos[0].title ? allVideos[0].title.substring(0,30) : 'N/A', assignedTo: allVideos[0].assignedToUserId });
    }
    return allVideos;

  } catch (error) {
    console.error(`[youtube-video-service][ALL_FILTER] Error fetching all videos: `, error);
    return [];
  }
}
