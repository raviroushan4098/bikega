
'use server';

import { db } from './firebase';
import { collection, addDoc, getDocs, query, Timestamp, orderBy, serverTimestamp, doc, setDoc, where, writeBatch, limit } from 'firebase/firestore';
import type { Mention } from '@/types';

const GLOBAL_MENTIONS_SUBCOLLECTION = 'globalMentions';

/**
 * Adds a new global mention to a user's subcollection in Firestore.
 * It uses the provided mention.id as the document ID.
 */
export async function addOrUpdateGlobalMention(userId: string, mention: Mention): Promise<string | { error: string }> {
  if (!userId) return { error: 'User ID is required.' };
  if (!mention.id) return { error: 'Mention ID is required for storing.' };

  try {
    const mentionDocRef = doc(db, 'users', userId, GLOBAL_MENTIONS_SUBCOLLECTION, mention.id);
    
    const mentionDataToSave = {
      ...mention,
      fetchedAt: serverTimestamp(), // Use server timestamp for when it's stored/updated
    };

    await setDoc(mentionDocRef, mentionDataToSave, { merge: true }); // Merge to update if exists, or create if not
    console.log(`[GlobalMentionsService] Added/Updated mention '${mention.id}' for user '${userId}'.`);
    return mention.id;
  } catch (error) {
    console.error(`[GlobalMentionsService] Error adding/updating mention '${mention.id}' for user '${userId}':`, error);
    if (error instanceof Error) {
      return { error: `Failed to add/update mention: ${error.message}` };
    }
    return { error: 'An unknown error occurred while adding/updating mention.' };
  }
}

/**
 * Fetches all global mentions for a given user, ordered by timestamp descending.
 */
export async function getGlobalMentionsForUser(userId: string): Promise<Mention[]> {
  if (!userId) {
    console.warn('[GlobalMentionsService] getGlobalMentionsForUser: No userId provided.');
    return [];
  }
  console.log(`[GlobalMentionsService] Fetching global mentions for user ${userId}.`);
  try {
    const mentionsCollectionRef = collection(db, 'users', userId, GLOBAL_MENTIONS_SUBCOLLECTION);
    // Order by publication timestamp primarily, then by fetchedAt as a secondary sort for items with same pub time
    const q = query(mentionsCollectionRef, orderBy('timestamp', 'desc'), orderBy('fetchedAt', 'desc'), limit(100)); // Limit to 100 most recent
    
    const querySnapshot = await getDocs(q);

    const mentions = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id, // Ensure the doc ID is part of the returned object
        timestamp: (data.timestamp instanceof Timestamp) ? data.timestamp.toDate().toISOString() : data.timestamp,
        fetchedAt: (data.fetchedAt instanceof Timestamp) ? data.fetchedAt.toDate().toISOString() : data.fetchedAt,
      } as Mention;
    });
    console.log(`[GlobalMentionsService] Fetched ${mentions.length} global mentions for user ${userId}.`);
    return mentions;
  } catch (error) {
    console.error(`[GlobalMentionsService] Error fetching global mentions for user ${userId}:`, error);
    return [];
  }
}

/**
 * Adds multiple mentions in a batch for a specific user.
 */
export async function addGlobalMentionsBatch(userId: string, mentions: Mention[]): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
  if (!userId) return { successCount: 0, errorCount: mentions.length, errors: ['User ID is required.'] };
  if (!mentions || mentions.length === 0) return { successCount: 0, errorCount: 0, errors: [] };

  const batch = writeBatch(db);
  const userMentionsColRef = collection(db, 'users', userId, GLOBAL_MENTIONS_SUBCOLLECTION);
  let successCount = 0;
  const errors: string[] = [];

  mentions.forEach(mention => {
    if (!mention.id) {
      errors.push(`Mention with title "${mention.title}" is missing an ID.`);
      return;
    }
    const mentionDocRef = doc(userMentionsColRef, mention.id);
    const mentionDataToSave = {
      ...mention,
      fetchedAt: serverTimestamp(),
    };
    batch.set(mentionDocRef, mentionDataToSave, { merge: true });
    successCount++;
  });

  try {
    await batch.commit();
    console.log(`[GlobalMentionsService] Batch added/updated ${successCount} mentions for user '${userId}'.`);
    return { successCount, errorCount: errors.length, errors };
  } catch (error) {
    console.error(`[GlobalMentionsService] Error committing batch for user '${userId}':`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown batch commit error.';
    return { successCount: 0, errorCount: mentions.length, errors: [...errors, errorMessage] };
  }
}
