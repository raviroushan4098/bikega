
'use server';

import { db } from './firebase';
import { collection, addDoc, getDocs, query, Timestamp, orderBy, doc, where } from 'firebase/firestore';
import type { YoutubeVideo } from '@/types';
import { getApiKeys } from './api-key-service';

const YOUTUBE_API_KEY_SERVICE_NAME = "YouTube Data API Key";

// This interface represents the data stored directly in the 'youtube_videos' collection
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
  assignedToUserId: string; // Now a direct field
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
        shareCount: 0, // YouTube API v3 does not provide share count directly for videos
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
      shareCount: videoDetails?.shareCount || 0, // Assuming 0 as API doesn't provide it
      channelTitle: videoDetails?.channelTitle || 'N/A',
      createdAt: createdAtTimestamp,
      fetchedFromApi: videoDetails?.fetchedFromApi || false,
      assignedToUserId: assignedToUserId, // Store assignedToUserId directly
    };

    // Add directly to the 'youtube_videos' collection
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

export async function getYoutubeVideosFromFirestore(userIdForFilter?: string): Promise<YoutubeVideo[]> {
  const videosCollectionRef = collection(db, 'youtube_videos');
  let q;

  try {
    if (!userIdForFilter || userIdForFilter === '') {
      console.log(`[youtube-video-service] getYoutubeVideosFromFirestore: No specific user ID selected for filtering. Returning empty array.`);
      return [];
    }

    if (userIdForFilter === 'all') {
      console.log(`[youtube-video-service] getYoutubeVideosFromFirestore: Querying for ALL videos from ALL users from 'youtube_videos' collection.`);
      q = query(videosCollectionRef, orderBy('createdAt', 'desc'));
    } else {
      // Specific user filter
      console.log(`[youtube-video-service] getYoutubeVideosFromFirestore: Querying for videos assigned to user ID: '${userIdForFilter}' from 'youtube_videos' collection.`);
      // This query will require a composite index: youtube_videos collection, assignedToUserId (ASC), createdAt (DESC)
      q = query(
        videosCollectionRef,
        where('assignedToUserId', '==', userIdForFilter),
        orderBy('createdAt', 'desc')
      );
    }

    const querySnapshot = await getDocs(q);
    const videos: YoutubeVideo[] = [];

    querySnapshot.forEach(docSnap => {
      try {
        const data = docSnap.data() as StoredYoutubeVideoData;
        if (!data.createdAt || typeof data.createdAt.toDate !== 'function') {
          console.warn(`[youtube-video-service] Video ID '${docSnap.id}' (Filter: ${userIdForFilter}) has missing or invalid 'createdAt' field. Skipping this video. Data:`, JSON.stringify(data));
          return;
        }
        if (!data.assignedToUserId) {
           console.warn(`[youtube-video-service] Video ID '${docSnap.id}' (Filter: ${userIdForFilter}) is missing 'assignedToUserId'. Skipping. Data:`, JSON.stringify(data));
           return;
        }
        videos.push({
          id: docSnap.id,
          url: data.url,
          title: data.title,
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
        console.error(`[youtube-video-service] Error processing video ID '${docSnap.id}' (Filter: ${userIdForFilter}):`, processError, "Problematic video data:", JSON.stringify(docSnap.data()));
      }
    });

    console.log(`[youtube-video-service] getYoutubeVideosFromFirestore: Found ${videos.length} videos for filter '${userIdForFilter}'.`);
    if (videos.length > 0 && userIdForFilter !== 'all') {
        console.log(`[youtube-video-service] First video returned for user '${userIdForFilter}': `, {id: videos[0].id, title: videos[0].title ? videos[0].title.substring(0,30) : 'N/A', assignedTo: videos[0].assignedToUserId });
    } else if (videos.length > 0 && userIdForFilter === 'all') {
        console.log(`[youtube-video-service] First video returned in 'all' view: `, {id: videos[0].id, title: videos[0].title ? videos[0].title.substring(0,30) : 'N/A', assignedTo: videos[0].assignedToUserId });
    }
    return videos;

  } catch (error) {
    console.error(`[youtube-video-service] getYoutubeVideosFromFirestore: Error fetching videos for filter '${userIdForFilter}': `, error);
    if (error instanceof Error && error.message) {
        if (error.message.includes('composite index') || error.message.includes('requires an index')) {
            console.error(`[youtube-video-service] FIRESTORE INDEX REQUIRED: The query for user '${userIdForFilter}' needs a composite index.`);
            console.error(`  Go to your Firebase console -> Firestore Database -> Indexes.`);
            console.error(`  Create an index for the 'youtube_videos' collection with fields:`);
            console.error(`    1. 'assignedToUserId' (Ascending)`);
            console.error(`    2. 'createdAt' (Descending)`);
        }
    }
    return [];
  }
}
