
'use server';

import { db } from './firebase';
import { collection, addDoc, getDocs, query, Timestamp, orderBy, doc, writeBatch } from 'firebase/firestore';
import type { YoutubeVideo, User } from '@/types';

// This interface now represents the data stored within a user's 'assigned_links' subcollection
export interface AssignedLinkData {
  url: string;
  title: string;
  thumbnailUrl: string;
  dataAiHint?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  channelTitle: string;
  createdAt: Timestamp; // Stored as Firestore Timestamp
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

    const createdAtTimestamp = Timestamp.now();
    // Data for the document in the 'assigned_links' subcollection
    const newLinkData: AssignedLinkData = {
      url: videoUrl,
      title: `Video: ${videoUrl.substring(0, 40)}...`, // Placeholder title
      thumbnailUrl: 'https://placehold.co/320x180.png',
      dataAiHint: 'custom video placeholder',
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      channelTitle: 'N/A', // Placeholder channel
      createdAt: createdAtTimestamp,
    };

    // Path to the user's 'assigned_links' subcollection
    const userAssignedLinksRef = collection(db, `youtube_videos/${assignedToUserId}/assigned_links`);
    const docRef = await addDoc(userAssignedLinksRef, newLinkData);

    console.log(`[youtube-video-service] Video added to Firestore at path: youtube_videos/${assignedToUserId}/assigned_links/${docRef.id}`);

    // Return a YoutubeVideo object consistent with the client-side type
    return {
      id: docRef.id, // This is the ID of the link document
      url: newLinkData.url,
      title: newLinkData.title,
      thumbnailUrl: newLinkData.thumbnailUrl,
      dataAiHint: newLinkData.dataAiHint,
      likeCount: newLinkData.likeCount,
      commentCount: newLinkData.commentCount,
      shareCount: newLinkData.shareCount,
      channelTitle: newLinkData.channelTitle,
      assignedToUserId: assignedToUserId, // Add this back for client-side consistency
      createdAt: createdAtTimestamp.toDate().toISOString(), // Convert to ISO string for client
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
    if (!userIdForFilter || userIdForFilter === 'all') {
      // For "All Assigned Videos", or if no user is specified, we return an empty array.
      // Fetching all videos across all user subcollections is complex and not implemented here.
      // Admin must select a specific user.
      console.log(`[youtube-video-service] getYoutubeVideosFromFirestore: No specific user ID provided or 'all' selected. Returning empty array. Admin should select a user.`);
      return [];
    }

    console.log(`[youtube-video-service] getYoutubeVideosFromFirestore: Querying for videos assigned to user ID: '${userIdForFilter}'`);
    const userAssignedLinksRef = collection(db, `youtube_videos/${userIdForFilter}/assigned_links`);
    const q = query(userAssignedLinksRef, orderBy('createdAt', 'desc'));

    const querySnapshot = await getDocs(q);
    const videos = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as AssignedLinkData; // Data from the link document
      return {
        id: docSnap.id, // ID of the link document
        url: data.url,
        title: data.title,
        thumbnailUrl: data.thumbnailUrl,
        dataAiHint: data.dataAiHint,
        likeCount: data.likeCount,
        commentCount: data.commentCount,
        shareCount: data.shareCount,
        channelTitle: data.channelTitle,
        assignedToUserId: userIdForFilter, // Add this back for client-side consistency
        createdAt: data.createdAt.toDate().toISOString(), // Convert Firestore Timestamp to ISO string
      } as YoutubeVideo;
    });

    console.log(`[youtube-video-service] getYoutubeVideosFromFirestore: Found ${videos.length} videos for user '${userIdForFilter}'.`);
    if (videos.length > 0) {
        console.log(`[youtube-video-service] First video returned for user '${userIdForFilter}': `, { id: videos[0].id, title: videos[0].title, assignedTo: videos[0].assignedToUserId });
    }
    return videos;

  } catch (error) {
    console.error(`[youtube-video-service] getYoutubeVideosFromFirestore: Error fetching videos for user '${userIdForFilter}': `, error);
    if (error instanceof Error && error.message && error.message.includes('composite index')) {
      console.error("[youtube-video-service] Firestore is likely missing a composite index for the subcollection query. Path: youtube_videos/{userId}/assigned_links, ordered by 'createdAt'. Please check Firebase console.");
    } else if (error instanceof Error && error.message && (error.message.includes('Fetched document to delete does not exist') || error.message.includes('No document to update'))) {
        // This might indicate an issue with the path, e.g. userIdForFilter doesn't exist as a document in youtube_videos
        console.warn(`[youtube-video-service] Potential issue with path for user '${userIdForFilter}'. The user document might not exist at 'youtube_videos/${userIdForFilter}'.`);
    }
    return []; // Return empty array on error
  }
}
