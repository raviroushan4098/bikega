
'use server';

import { db } from './firebase';
import { collection, addDoc, getDocs, query, Timestamp, orderBy, doc, writeBatch } from 'firebase/firestore';
import type { YoutubeVideo } from '@/types';
import { getApiKeys } from './api-key-service'; // To fetch the YouTube API key

const YOUTUBE_API_KEY_SERVICE_NAME = "YouTube Data API Key";

// This interface now represents the data stored within a user's 'assigned_links' subcollection
export interface AssignedLinkData {
  url: string;
  title: string;
  thumbnailUrl: string;
  dataAiHint?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number; // YouTube API might not provide share count directly, might be 0 or estimated
  channelTitle: string;
  createdAt: Timestamp; // Stored as Firestore Timestamp
  fetchedFromApi: boolean; // To track if details were fetched
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

async function fetchVideoDetailsFromYouTubeAPI(videoId: string): Promise<Partial<AssignedLinkData> | null> {
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
        dataAiHint: `youtube video ${snippet.title?.substring(0,20) || ''}`, // Basic hint
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
    let videoDetails: Partial<AssignedLinkData> | null = null;

    if (videoId) {
      videoDetails = await fetchVideoDetailsFromYouTubeAPI(videoId);
    } else {
      console.warn(`[youtube-video-service] Could not extract Video ID from URL: ${videoUrl}. Using placeholders.`);
    }

    const createdAtTimestamp = Timestamp.now();

    const newLinkData: AssignedLinkData = {
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
    };

    const userAssignedLinksRef = collection(db, `youtube_videos/${assignedToUserId}/assigned_links`);
    const docRef = await addDoc(userAssignedLinksRef, newLinkData);

    console.log(`[youtube-video-service] Video added to Firestore at path: youtube_videos/${assignedToUserId}/assigned_links/${docRef.id}. Fetched from API: ${newLinkData.fetchedFromApi}`);

    return {
      id: docRef.id,
      url: newLinkData.url,
      title: newLinkData.title,
      thumbnailUrl: newLinkData.thumbnailUrl,
      dataAiHint: newLinkData.dataAiHint,
      likeCount: newLinkData.likeCount,
      commentCount: newLinkData.commentCount,
      shareCount: newLinkData.shareCount,
      channelTitle: newLinkData.channelTitle,
      assignedToUserId: assignedToUserId,
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
  try {
    if (!userIdForFilter) {
      console.log(`[youtube-video-service] getYoutubeVideosFromFirestore: No specific user ID or 'all' selected for filtering. Returning empty array.`);
      return [];
    }

    if (userIdForFilter === 'all') {
      console.log(`[youtube-video-service] getYoutubeVideosFromFirestore: Querying for ALL videos from ALL users.`);
      const allVideos: YoutubeVideo[] = [];
      const usersCollectionRef = collection(db, `youtube_videos`);
      const usersSnapshot = await getDocs(usersCollectionRef);
      console.log(`[youtube-video-service][ALL_FILTER] Found ${usersSnapshot.docs.length} document(s) in 'youtube_videos' collection (these should be user IDs).`);

      if (usersSnapshot.empty) {
          console.log("[youtube-video-service][ALL_FILTER] 'youtube_videos' collection is empty. No users have had videos assigned or the collection structure is unexpected.");
          return [];
      }

      for (const userDoc of usersSnapshot.docs) {
        const currentUserId = userDoc.id;
        const subcollectionPath = `youtube_videos/${currentUserId}/assigned_links`;
        console.log(`[youtube-video-service][ALL_FILTER] Processing user ID: ${currentUserId}. Querying subcollection at path: ${subcollectionPath}`);

        const userAssignedLinksRef = collection(db, subcollectionPath);
        const q = query(userAssignedLinksRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        console.log(`[youtube-video-service][ALL_FILTER] Found ${querySnapshot.docs.length} videos for user ${currentUserId}.`);

        querySnapshot.docs.forEach(docSnap => {
          const data = docSnap.data() as AssignedLinkData;
          allVideos.push({
            id: docSnap.id,
            url: data.url,
            title: data.title,
            thumbnailUrl: data.thumbnailUrl,
            dataAiHint: data.dataAiHint,
            likeCount: data.likeCount,
            commentCount: data.commentCount,
            shareCount: data.shareCount,
            channelTitle: data.channelTitle,
            assignedToUserId: currentUserId,
            createdAt: data.createdAt.toDate().toISOString(),
          });
        });
      }
      allVideos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      console.log(`[youtube-video-service][ALL_FILTER] Aggregated ${allVideos.length} videos in total for ALL users.`);
      return allVideos;
    }

    console.log(`[youtube-video-service] getYoutubeVideosFromFirestore: Querying for videos assigned to user ID: '${userIdForFilter}'`);
    const userAssignedLinksRef = collection(db, `youtube_videos/${userIdForFilter}/assigned_links`);
    const q = query(userAssignedLinksRef, orderBy('createdAt', 'desc'));

    const querySnapshot = await getDocs(q);
    const videos = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as AssignedLinkData;
      return {
        id: docSnap.id,
        url: data.url,
        title: data.title,
        thumbnailUrl: data.thumbnailUrl,
        dataAiHint: data.dataAiHint,
        likeCount: data.likeCount,
        commentCount: data.commentCount,
        shareCount: data.shareCount,
        channelTitle: data.channelTitle,
        assignedToUserId: userIdForFilter,
        createdAt: data.createdAt.toDate().toISOString(),
      } as YoutubeVideo;
    });

    console.log(`[youtube-video-service] getYoutubeVideosFromFirestore: Found ${videos.length} videos for user '${userIdForFilter}'.`);
    if (videos.length > 0) {
        console.log(`[youtube-video-service] First video returned for user '${userIdForFilter}': `, {id: videos[0].id, title: videos[0].title, assignedTo: videos[0].assignedToUserId });
    }
    return videos;

  } catch (error) {
    console.error(`[youtube-video-service] getYoutubeVideosFromFirestore: Error fetching videos for filter '${userIdForFilter}': `, error);
    if (error instanceof Error && error.message && error.message.includes('composite index')) {
      console.error("[youtube-video-service] Firestore is likely missing a composite index for the subcollection query. Path: youtube_videos/{userId}/assigned_links, ordered by 'createdAt'. Please check Firebase console.");
    } else if (error instanceof Error && error.message && (error.message.includes('Fetched document to delete does not exist') || error.message.includes('No document to update'))) {
        console.warn(`[youtube-video-service] Potential issue with path for user '${userIdForFilter}'. The user document might not exist at 'youtube_videos/${userIdForFilter}'.`);
    }
    return [];
  }
}

    