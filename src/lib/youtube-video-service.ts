
'use server';

import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
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
  createdAt: Timestamp;
}

export async function addYoutubeVideoToFirestore(
  videoUrl: string,
  assignedToUserId: string
): Promise<YoutubeVideo> {
  try {
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
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'youtube_videos'), newVideoData);
    
    // Convert Firestore Timestamp to Date for the client-side type if necessary
    // For simplicity, we're constructing the return object to match YoutubeVideo,
    // assuming createdAt will be handled as a string or Date on the client.
    // Firestore's serverTimestamp() is better for production for createdAt.
    
    return {
      id: docRef.id,
      ...newVideoData,
      // Ensure createdAt is a string or Date as per YoutubeVideo type for client use
      // For this example, we'll assume the client handles the Timestamp object
      // or converts it. If YoutubeVideo expects a string, convert newVideoData.createdAt.toDate().toISOString()
    } as unknown as YoutubeVideo; // Adjust if YoutubeVideo expects Date/string for createdAt

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
      q = query(videosCollectionRef, where('assignedToUserId', '==', userIdForFilter), orderBy('createdAt', 'desc'));
    } else {
      // Fetch all videos if no specific user ID or 'all' is passed (for admin view)
      q = query(videosCollectionRef, orderBy('createdAt', 'desc'));
    }

    const querySnapshot = await getDocs(q);
    const videos = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to ISO string or Date object if your YoutubeVideo type expects that
        // For example, if data.createdAt is a Firestore Timestamp:
        // createdAt: data.createdAt.toDate().toISOString(), 
      } as YoutubeVideo;
    });
    return videos;
  } catch (error) {
    console.error("Error fetching YouTube videos from Firestore: ", error);
    return []; // Return empty array on error
  }
}
