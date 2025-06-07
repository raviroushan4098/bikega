
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
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    const msg = 'User ID is required and must be a non-empty string.';
    console.error(`[GlobalMentionsService (addOrUpdateGlobalMention)] ${msg}`);
    return { error: msg };
  }
  if (!mention.id || typeof mention.id !== 'string' || mention.id.trim() === "") {
    const msg = 'Mention ID is required and must be a non-empty string for storing.';
    console.error(`[GlobalMentionsService (addOrUpdateGlobalMention)] ${msg}`);
    return { error: msg };
  }

  console.log(`[GlobalMentionsService (addOrUpdateGlobalMention)] UserID: ${userId}, MentionID: ${mention.id}, Title: "${mention.title?.substring(0,30)}..."`);
  try {
    const mentionDocRef = doc(db, 'users', userId, GLOBAL_MENTIONS_SUBCOLLECTION, mention.id);
    
    const mentionDataToSave = {
      ...mention,
      id: String(mention.id || `generated_${Date.now()}`),
      platform: String(mention.platform || 'Unknown') as Mention['platform'],
      source: String(mention.source || 'Unknown Source'),
      title: String(mention.title || 'No Title'),
      excerpt: String(mention.excerpt || 'No Excerpt'),
      url: String(mention.url || '#'),
      timestamp: (mention.timestamp instanceof Date) ? mention.timestamp.toISOString() : String(mention.timestamp || new Date().toISOString()),
      matchedKeyword: String(mention.matchedKeyword || 'general'),
      sentiment: mention.sentiment && ['positive', 'negative', 'neutral', 'unknown'].includes(mention.sentiment) ? mention.sentiment : 'unknown',
      fetchedAt: serverTimestamp(),
    };
    
    // Ensure sentiment is not explicitly undefined for Firestore
    if (mentionDataToSave.sentiment === undefined) {
      // This case should ideally not be hit due to the line above, but as a safeguard:
      console.log(`[GlobalMentionsService (addOrUpdateGlobalMention)] Mention ID ${mention.id} had undefined sentiment, explicitly setting to 'unknown'.`);
      mentionDataToSave.sentiment = 'unknown';
    }


    await setDoc(mentionDocRef, mentionDataToSave, { merge: true }); 
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
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    console.warn('[GlobalMentionsService (getGlobalMentionsForUser)] Invalid or missing userId provided. Received:', userId);
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
      if (docSnap.id === querySnapshot.docs[0].id) { 
          console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Raw data for first doc ID ${docSnap.id} (User ${userId}): ${JSON.stringify(data)}`);
      }
      return {
        ...data,
        id: docSnap.id,
        timestamp: (data.timestamp instanceof Timestamp) ? data.timestamp.toDate().toISOString() : String(data.timestamp || new Date(0).toISOString()),
        fetchedAt: (data.fetchedAt instanceof Timestamp) ? data.fetchedAt.toDate().toISOString() : String(data.fetchedAt || new Date(0).toISOString()),
        platform: String(data.platform || 'Unknown') as Mention['platform'],
        source: String(data.source || 'Unknown Source'),
        title: String(data.title || 'No Title'),
        excerpt: String(data.excerpt || 'No Excerpt'),
        url: String(data.url || '#'),
        matchedKeyword: String(data.matchedKeyword || 'general'),
        sentiment: data.sentiment && ['positive', 'negative', 'neutral', 'unknown'].includes(data.sentiment) ? data.sentiment : 'unknown',
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
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    const msg = `User ID is required, must be a non-empty string. Received: '${userId}'`;
    console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] CRITICAL: ${msg}`);
    return { successCount: 0, errorCount: mentions?.length || 0, errors: [msg] };
  }
  if (!mentions || mentions.length === 0) {
    console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] No mentions provided in batch to store for user '${userId}'.`);
    return { successCount: 0, errorCount: 0, errors: [] };
  }

  console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] Starting batch add for user '${userId}'. ${mentions.length} mentions to process.`);
  const batch = writeBatch(db);
  const userMentionsColRef = collection(db, 'users', userId, GLOBAL_MENTIONS_SUBCOLLECTION);
  let processedForBatchCount = 0;
  const localErrors: string[] = [];
  let firstDocPathForLogging: string | null = null;

  mentions.forEach((mention, index) => {
    if (!mention.id || typeof mention.id !== 'string' || mention.id.trim() === "") {
      localErrors.push(`Mention at index ${index} (title "${mention.title?.substring(0,30)}...") is missing a valid ID. Skipping.`);
      console.warn(`[GlobalMentionsService (addGlobalMentionsBatch)] Mention at index ${index} is missing an ID. Title: "${mention.title?.substring(0,30)}..."`);
      return;
    }
    const mentionDocRef = doc(userMentionsColRef, mention.id);
    if (!firstDocPathForLogging) {
        firstDocPathForLogging = mentionDocRef.path;
    }
    
    // Ensure data consistency before saving
    const mentionDataToSave: Omit<Mention, 'fetchedAt'> & { fetchedAt: any } = {
      id: String(mention.id), // Ensure ID is a string
      platform: String(mention.platform || 'Unknown') as Mention['platform'],
      source: String(mention.source || 'Unknown Source'),
      title: String(mention.title || 'No Title Provided'),
      excerpt: String(mention.excerpt || 'No Excerpt Provided'),
      url: String(mention.url || '#'), // Default to '#' if URL is missing
      timestamp: (mention.timestamp instanceof Date) 
                 ? mention.timestamp.toISOString() 
                 : String(mention.timestamp || new Date().toISOString()), // Default to now if missing
      matchedKeyword: String(mention.matchedKeyword || 'general'), // Default if missing
      sentiment: mention.sentiment && ['positive', 'negative', 'neutral', 'unknown'].includes(mention.sentiment) 
                 ? mention.sentiment 
                 : 'unknown', // Default to 'unknown'
      fetchedAt: serverTimestamp(),
    };

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

  console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] Attempting to commit batch with ${processedForBatchCount} mentions for user '${userId}'. First document path (example): ${firstDocPathForLogging || 'N/A'}`);
  try {
    await batch.commit();
    console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] SUCCESS: Batch committed ${processedForBatchCount} mentions for user '${userId}'.`);
    return { successCount: processedForBatchCount, errorCount: localErrors.length, errors: localErrors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown batch commit error.';
    console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] FAILURE: Error committing batch for user '${userId}'. Error: ${errorMessage}`, error);
    if (!(error instanceof Error) && error && typeof error === 'object') {
        console.error('[GlobalMentionsService (addGlobalMentionsBatch)] Non-standard error object details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } else if (!(error instanceof Error)) {
         console.error('[GlobalMentionsService (addGlobalMentionsBatch)] Non-standard, non-object error:', error);
    }
    return { successCount: 0, errorCount: processedForBatchCount + localErrors.length, errors: [...localErrors, `Batch commit failed: ${errorMessage}`] };
  }
}

