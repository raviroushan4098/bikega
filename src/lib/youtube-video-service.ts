
'use server';

import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, Timestamp, orderBy, doc } from 'firebase/firestore';
import type { YoutubeVideo } from '@/types';

// Define the structure of the data to be stored in Firestore, omitting the client-side 'id'
export interface NewYoutubeVideoData {
  url: string;
  title: string;
  thumbnailUrl: string;
  dataAiHint?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  channelTitle: string;
  assignedToUserId: string;
  createdAt: Timestamp; // Stored as Firestore Timestamp
}

export async function addYoutubeVideoToFirestore(
  videoUrl: string,
  assignedToUserId: string
): Promise<YoutubeVideo> {
  try {
    const createdAtTimestamp = Timestamp.now();
    const newVideoData: NewYoutubeVideoData = {
      url: videoUrl,
      title: `Video: ${videoUrl.substring(0, 40)}...`, // Placeholder title
      thumbnailUrl: 'https://placehold.co/320x180.png',
      dataAiHint: 'custom video placeholder',
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      channelTitle: 'N/A', // Placeholder channel
      assignedToUserId: assignedToUserId,
      createdAt: createdAtTimestamp,
    };

    const docRef = await addDoc(collection(db, 'youtube_videos'), newVideoData);
    
    return {
      id: docRef.id,
      url: newVideoData.url,
      title: newVideoData.title,
      thumbnailUrl: newVideoData.thumbnailUrl,
      dataAiHint: newVideoData.dataAiHint,
      likeCount: newVideoData.likeCount,
      commentCount: newVideoData.commentCount,
      shareCount: newVideoData.shareCount,
      channelTitle: newVideoData.channelTitle,
      assignedToUserId: newVideoData.assignedToUserId,
      createdAt: createdAtTimestamp.toDate().toISOString(), // Convert to ISO string for client
    };

  } catch (error) {
    console.error("Error adding YouTube video to Firestore: ", error);
    throw new Error("Failed to save video assignment.");
  }
}

export async function getYoutubeVideosFromFirestore(userIdForFilter?: string): Promise<YoutubeVideo[]> {
  try {
    const videosCollectionRef = collection(db, 'youtube_videos');
    let q;

    if (userIdForFilter && userIdForFilter !== 'all') {
      console.log(`[getYoutubeVideosFromFirestore] Querying for videos assigned to user ID: '${userIdForFilter}'`);
      q = query(videosCollectionRef, where('assignedToUserId', '==', userIdForFilter), orderBy('createdAt', 'desc'));
    } else {
      console.log("[getYoutubeVideosFromFirestore] Querying for ALL videos (no specific user filter).");
      q = query(videosCollectionRef, orderBy('createdAt', 'desc'));
    }

    const querySnapshot = await getDocs(q);
    const videos = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as NewYoutubeVideoData; // Assert type based on Firestore structure
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
        assignedToUserId: data.assignedToUserId,
        createdAt: data.createdAt.toDate().toISOString(), // Convert Firestore Timestamp to ISO string
      } as YoutubeVideo; // Ensure it matches the client-side YoutubeVideo type
    });
    console.log(`[getYoutubeVideosFromFirestore] Found ${videos.length} videos for filter '${userIdForFilter || 'all'}'.`);
    return videos;
  } catch (error) {
    console.error(`[getYoutubeVideosFromFirestore] Error fetching videos for filter '${userIdForFilter || 'all'}': `, error);
    // Check if the error message suggests creating an index
    if (error instanceof Error && error.message && error.message.includes('composite index')) {
      console.error("[getYoutubeVideosFromFirestore] Firestore is likely missing a composite index. Please check the Firebase console for a link to create it. The query involves filtering by 'assignedToUserId' and ordering by 'createdAt'.");
    }
    return []; // Return empty array on error
  }
}

