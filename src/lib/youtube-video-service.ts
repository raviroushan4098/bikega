
'use server';

import type { YoutubeVideo } from '@/types';
import { getApiKeys } from './api-key-service';

const YOUTUBE_API_KEY_SERVICE_NAME = "YouTube Data API Key";

// Interface for the raw API response for video details
interface YouTubeApiVideoItem {
  id: string;
  snippet: {
    title: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
    channelTitle: string;
    description?: string; // For dataAiHint
  };
  statistics?: {
    likeCount?: string;
    commentCount?: string;
    viewCount?: string; // viewCount might be useful too
  };
}

// This function is now a local helper, not exported, so it's not treated as a Server Action.
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

export async function fetchVideoDetailsFromYouTubeAPI(
  videoUrlOrId: string,
  assignedToUserId: string, 
  assignedToUserName?: string
): Promise<YoutubeVideo | null> {
  const videoId = extractYouTubeVideoId(videoUrlOrId) || videoUrlOrId; 
  if (!videoId) {
    console.error(`[youtube-video-service] Could not extract valid video ID from: ${videoUrlOrId}`);
    return null;
  }

  const apiKeys = await getApiKeys();
  const youtubeApiKeyEntry = apiKeys.find(k => k.serviceName === YOUTUBE_API_KEY_SERVICE_NAME);

  if (!youtubeApiKeyEntry || !youtubeApiKeyEntry.keyValue) {
    console.warn(`[youtube-video-service] '${YOUTUBE_API_KEY_SERVICE_NAME}' not found or empty in API Management. Cannot fetch video details for ID '${videoId}'.`);
    return {
      id: videoId,
      url: videoUrlOrId.startsWith('http') ? videoUrlOrId : `https://www.youtube.com/watch?v=${videoId}`,
      title: `Video ID: ${videoId} (Details unavailable - Check API Key)`,
      thumbnailUrl: 'https://placehold.co/320x180.png?text=No+API+Key',
      channelTitle: 'N/A',
      assignedToUserId: assignedToUserId,
      assignedToUserName: assignedToUserName,
      dataAiHint: 'video placeholder',
    };
  }
  const apiKey = youtubeApiKeyEntry.keyValue;
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,statistics`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[youtube-video-service] YouTube API error for video ID '${videoId}' (${response.status}):`, errorData.error?.message || response.statusText);
      return { 
        id: videoId,
        url: videoUrlOrId.startsWith('http') ? videoUrlOrId : `https://www.youtube.com/watch?v=${videoId}`,
        title: `Video ID: ${videoId} (API Error)`,
        thumbnailUrl: 'https://placehold.co/320x180.png?text=API+Error',
        channelTitle: 'N/A',
        assignedToUserId: assignedToUserId,
        assignedToUserName: assignedToUserName,
        dataAiHint: 'video error',
      };
    }
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const item: YouTubeApiVideoItem = data.items[0];
      const snippet = item.snippet;
      const statistics = item.statistics;
      
      let hint = "youtube video";
      if (snippet.description && snippet.description.length > 10) {
        hint = snippet.description.split(" ").slice(0, 2).join(" ");
      } else if (snippet.title) {
         hint = snippet.title.split(" ").slice(0, 2).join(" ");
      }


      return {
        id: item.id,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        title: snippet.title || 'N/A',
        thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || 'https://placehold.co/320x180.png',
        channelTitle: snippet.channelTitle || 'N/A',
        likeCount: statistics?.likeCount ? parseInt(statistics.likeCount, 10) : 0,
        commentCount: statistics?.commentCount ? parseInt(statistics.commentCount, 10) : 0,
        assignedToUserId: assignedToUserId,
        assignedToUserName: assignedToUserName,
        dataAiHint: hint.toLowerCase(),
      };
    }
    console.warn(`[youtube-video-service] Video ID '${videoId}' not found via YouTube API.`);
    return { 
        id: videoId,
        url: videoUrlOrId.startsWith('http') ? videoUrlOrId : `https://www.youtube.com/watch?v=${videoId}`,
        title: `Video ID: ${videoId} (Not found by API)`,
        thumbnailUrl: 'https://placehold.co/320x180.png?text=Not+Found',
        channelTitle: 'N/A',
        assignedToUserId: assignedToUserId,
        assignedToUserName: assignedToUserName,
        dataAiHint: 'video notfound',
      };
  } catch (error) {
    console.error(`[youtube-video-service] Error fetching from YouTube API for video ID '${videoId}': `, error);
     return { 
        id: videoId,
        url: videoUrlOrId.startsWith('http') ? videoUrlOrId : `https://www.youtube.com/watch?v=${videoId}`,
        title: `Video ID: ${videoId} (Fetch Error)`,
        thumbnailUrl: 'https://placehold.co/320x180.png?text=Fetch+Error',
        channelTitle: 'N/A',
        assignedToUserId: assignedToUserId,
        assignedToUserName: assignedToUserName,
        dataAiHint: 'video fetcherror',
      };
  }
}

export async function fetchBatchVideoDetailsFromYouTubeAPI(
  videoIds: string[],
  assignedToUserMap: Record<string, { userId: string, userName?: string }> 
): Promise<YoutubeVideo[]> {
  if (!videoIds || videoIds.length === 0) {
    return [];
  }

  const apiKeys = await getApiKeys();
  const youtubeApiKeyEntry = apiKeys.find(k => k.serviceName === YOUTUBE_API_KEY_SERVICE_NAME);

  if (!youtubeApiKeyEntry || !youtubeApiKeyEntry.keyValue) {
    console.warn(`[youtube-video-service] '${YOUTUBE_API_KEY_SERVICE_NAME}' not found. Cannot batch fetch details.`);
    return videoIds.map(videoId => {
      const assignment = assignedToUserMap[videoId] || { userId: 'unknown', userName: 'Unknown User' };
      return {
        id: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: `Video ID: ${videoId} (Details unavailable - Check API Key)`,
        thumbnailUrl: 'https://placehold.co/320x180.png?text=No+API+Key',
        channelTitle: 'N/A',
        assignedToUserId: assignment.userId,
        assignedToUserName: assignment.userName,
        dataAiHint: 'video placeholder',
      };
    });
  }
  const apiKey = youtubeApiKeyEntry.keyValue;

  const CHUNK_SIZE = 50;
  const detailedVideos: YoutubeVideo[] = [];

  for (let i = 0; i < videoIds.length; i += CHUNK_SIZE) {
    const chunk = videoIds.slice(i, i + CHUNK_SIZE);
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${chunk.join(',')}&key=${apiKey}&part=snippet,statistics`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[youtube-video-service] Batch YouTube API error (${response.status}):`, errorData.error?.message || response.statusText);
        chunk.forEach(videoId => {
          const assignment = assignedToUserMap[videoId] || { userId: 'unknown', userName: 'Unknown User' };
          detailedVideos.push({
            id: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: `Video ID: ${videoId} (API Error)`,
            thumbnailUrl: 'https://placehold.co/320x180.png?text=API+Error',
            channelTitle: 'N/A',
            assignedToUserId: assignment.userId,
            assignedToUserName: assignment.userName,
            dataAiHint: 'video error',
          });
        });
        continue; 
      }
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        data.items.forEach((item: YouTubeApiVideoItem) => {
          const snippet = item.snippet;
          const statistics = item.statistics;
          const assignment = assignedToUserMap[item.id] || { userId: 'unknown', userName: 'Unknown User' };
          
          let hint = "youtube video";
          if (snippet.description && snippet.description.length > 10) {
            hint = snippet.description.split(" ").slice(0, 2).join(" ");
          } else if (snippet.title) {
            hint = snippet.title.split(" ").slice(0, 2).join(" ");
          }

          detailedVideos.push({
            id: item.id,
            url: `https://www.youtube.com/watch?v=${item.id}`,
            title: snippet.title || 'N/A',
            thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || 'https://placehold.co/320x180.png',
            channelTitle: snippet.channelTitle || 'N/A',
            likeCount: statistics?.likeCount ? parseInt(statistics.likeCount, 10) : 0,
            commentCount: statistics?.commentCount ? parseInt(statistics.commentCount, 10) : 0,
            assignedToUserId: assignment.userId,
            assignedToUserName: assignment.userName,
            dataAiHint: hint.toLowerCase(),
          });
        });
      }
      const foundIds = new Set(data.items?.map((item: YouTubeApiVideoItem) => item.id) || []);
      chunk.forEach(videoId => {
        if (!foundIds.has(videoId)) {
          const assignment = assignedToUserMap[videoId] || { userId: 'unknown', userName: 'Unknown User' };
          detailedVideos.push({
            id: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: `Video ID: ${videoId} (Not found by API)`,
            thumbnailUrl: 'https://placehold.co/320x180.png?text=Not+Found',
            channelTitle: 'N/A',
            assignedToUserId: assignment.userId,
            assignedToUserName: assignment.userName,
            dataAiHint: 'video notfound',
          });
        }
      });

    } catch (error) {
      console.error(`[youtube-video-service] Error batch fetching from YouTube API: `, error);
      chunk.forEach(videoId => {
          const assignment = assignedToUserMap[videoId] || { userId: 'unknown', userName: 'Unknown User' };
          detailedVideos.push({
            id: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: `Video ID: ${videoId} (Fetch Error)`,
            thumbnailUrl: 'https://placehold.co/320x180.png?text=Fetch+Error',
            channelTitle: 'N/A',
            assignedToUserId: assignment.userId,
            assignedToUserName: assignment.userName,
            dataAiHint: 'video fetcherror',
          });
        });
    }
  }
  return detailedVideos;
}
