
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

  console.log(`[GlobalMentionsService (addOrUpdateGlobalMention)] UserID: ${userId}, MentionID: ${mention.id}, Title: "${mention.title.substring(0,30)}..."`);
  try {
    const mentionDocRef = doc(db, 'users', userId, GLOBAL_MENTIONS_SUBCOLLECTION, mention.id);
    
    const mentionDataToSave = {
      ...mention,
      timestamp: (mention.timestamp instanceof Date) ? mention.timestamp.toISOString() : mention.timestamp, // Ensure ISO string
      fetchedAt: serverTimestamp(), // Use server timestamp for when it's stored/updated
    };
    // Remove undefined sentiment to avoid issues with Firestore merge if field doesn't exist
    if (mentionDataToSave.sentiment === undefined) {
      delete mentionDataToSave.sentiment;
    }


    await setDoc(mentionDocRef, mentionDataToSave, { merge: true }); // Merge to update if exists, or create if not
    console.log(`[GlobalMentionsService (addOrUpdateGlobalMention)] Successfully Added/Updated mention '${mention.id}' for user '${userId}'.`);
    return mention.id;
  } catch (error) {
    console.error(`[GlobalMentionsService (addOrUpdateGlobalMention)] Error adding/updating mention '${mention.id}' for user '${userId}':`, error);
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
    console.warn('[GlobalMentionsService (getGlobalMentionsForUser)] No userId provided.');
    return [];
  }
  console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Fetching global mentions for user ${userId}.`);
  try {
    const mentionsCollectionRef = collection(db, 'users', userId, GLOBAL_MENTIONS_SUBCOLLECTION);
    const q = query(mentionsCollectionRef, orderBy('timestamp', 'desc'), orderBy('fetchedAt', 'desc'), limit(100));
    
    const querySnapshot = await getDocs(q);
    console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Firestore query for user '${userId}' returned ${querySnapshot.docs.length} raw documents.`);

    if (querySnapshot.empty) {
      console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] No documents found for user '${userId}'.`);
      return [];
    }

    const mentions = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      // Log raw data for one document to inspect its structure
      if (docSnap.id === querySnapshot.docs[0].id) { // Log first doc
          console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Raw data for doc ID ${docSnap.id} (User ${userId}): ${JSON.stringify(data)}`);
      }
      return {
        ...data,
        id: docSnap.id,
        timestamp: (data.timestamp instanceof Timestamp) ? data.timestamp.toDate().toISOString() : data.timestamp,
        fetchedAt: (data.fetchedAt instanceof Timestamp) ? data.fetchedAt.toDate().toISOString() : data.fetchedAt,
      } as Mention;
    });
    console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Successfully mapped ${mentions.length} mentions for user ${userId}. First item (if any): ${mentions.length > 0 ? JSON.stringify(mentions[0]) : 'N/A'}`);
    return mentions;
  } catch (error) {
    console.error(`[GlobalMentionsService (getGlobalMentionsForUser)] Error fetching global mentions for user ${userId}:`, error);
    return [];
  }
}

/**
 * Adds multiple mentions in a batch for a specific user.
 */
export async function addGlobalMentionsBatch(userId: string, mentions: Mention[]): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
  if (!userId) {
    console.error('[GlobalMentionsService (addGlobalMentionsBatch)] User ID is required.');
    return { successCount: 0, errorCount: mentions.length, errors: ['User ID is required.'] };
  }
  if (!mentions || mentions.length === 0) {
    console.log('[GlobalMentionsService (addGlobalMentionsBatch)] No mentions provided in batch to store.');
    return { successCount: 0, errorCount: 0, errors: [] };
  }

  console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] Starting batch add for user '${userId}'. ${mentions.length} mentions to process.`);
  const batch = writeBatch(db);
  const userMentionsColRef = collection(db, 'users', userId, GLOBAL_MENTIONS_SUBCOLLECTION);
  let processedForBatchCount = 0;
  const localErrors: string[] = [];

  mentions.forEach((mention, index) => {
    if (!mention.id || mention.id.trim() === "") {
      localErrors.push(`Mention at index ${index} (title "${mention.title.substring(0,30)}...") is missing a valid ID. Skipping.`);
      console.warn(`[GlobalMentionsService (addGlobalMentionsBatch)] Mention at index ${index} is missing an ID. Title: "${mention.title.substring(0,30)}..."`);
      return;
    }
    const mentionDocRef = doc(userMentionsColRef, mention.id);
    const mentionDataToSave = {
      ...mention,
      timestamp: (mention.timestamp instanceof Date) ? mention.timestamp.toISOString() : mention.timestamp, // Ensure ISO string
      fetchedAt: serverTimestamp(),
    };
    // Remove undefined sentiment to avoid issues with Firestore merge if field doesn't exist
     if (mentionDataToSave.sentiment === undefined) {
      delete mentionDataToSave.sentiment;
      console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] Mention ID ${mention.id} had undefined sentiment, removing field before save.`);
    }

    batch.set(mentionDocRef, mentionDataToSave, { merge: true });
    processedForBatchCount++;
  });

  if (processedForBatchCount === 0 && localErrors.length > 0) {
      console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] No valid mentions to commit for user '${userId}' due to missing IDs. Errors: ${localErrors.join('; ')}`);
      return { successCount: 0, errorCount: mentions.length, errors: localErrors };
  }
  if (processedForBatchCount === 0 && localErrors.length === 0) {
      console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] No mentions were processed for batch commit for user '${userId}', although no explicit errors with IDs. Original count: ${mentions.length}`);
      return { successCount: 0, errorCount: 0, errors: [] };
  }


  console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] Committing batch with ${processedForBatchCount} mentions for user '${userId}'.`);
  try {
    await batch.commit();
    console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] SUCCESS: Batch committed ${processedForBatchCount} mentions for user '${userId}'.`);
    return { successCount: processedForBatchCount, errorCount: localErrors.length, errors: localErrors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown batch commit error.';
    console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] FAILURE: Error committing batch for user '${userId}'. Error: ${errorMessage}`, error);
    // Add details about the error object if it's not a standard Error instance
    if (!(error instanceof Error)) {
        console.error('[GlobalMentionsService (addGlobalMentionsBatch)] Non-standard error object:', JSON.stringify(error, null, 2));
    }
    return { successCount: 0, errorCount: processedForBatchCount + localErrors.length, errors: [...localErrors, `Batch commit failed: ${errorMessage}`] };
  }
}

