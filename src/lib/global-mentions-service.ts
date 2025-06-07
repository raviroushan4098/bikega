
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
      fetchedAt: serverTimestamp(), // Use serverTimestamp for consistency
    };
    
    // Ensure sentiment is not explicitly undefined for Firestore
    if (mentionDataToSave.sentiment === undefined) {
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
  const mentionsCollectionPath = `users/${userId}/${GLOBAL_MENTIONS_SUBCOLLECTION}`;
  console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Fetching global mentions for user ${userId} from path: '${mentionsCollectionPath}'.`);
  try {
    const mentionsCollectionRef = collection(db, 'users', userId, GLOBAL_MENTIONS_SUBCOLLECTION);
    // Temporarily simplify query to rule out orderBy fetchedAt issues
    const q = query(mentionsCollectionRef, orderBy('timestamp', 'desc'), limit(100)); 
    
    const querySnapshot = await getDocs(q);
    console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Firestore query for user '${userId}' (path: ${mentionsCollectionRef.path}) returned ${querySnapshot.docs.length} raw documents.`);

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
 * DEBUG VERSION: Adds only the first valid mention using setDoc for a specific user.
 */
export async function addGlobalMentionsBatch(userId: string, mentions: Mention[]): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    const msg = `User ID is required, must be a non-empty string. Received: '${userId}'`;
    console.error(`[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] CRITICAL: ${msg}`);
    return { successCount: 0, errorCount: mentions?.length || 0, errors: [msg] };
  }
  console.log(`[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] UserID: ${userId}. Attempting to process ${mentions.length} mentions. Simplified DEBUG write (only first valid item).`);

  if (!mentions || mentions.length === 0) {
    console.log(`[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] No mentions provided for user '${userId}'.`);
    return { successCount: 0, errorCount: 0, errors: [] };
  }

  const localErrors: string[] = [];
  let successCount = 0;

  const firstValidMention = mentions.find(m => m.id && typeof m.id === 'string' && m.id.trim() !== "");

  if (!firstValidMention) {
    const msg = `No valid mention with an ID found in the provided ${mentions.length} mentions for user '${userId}'. Cannot perform DEBUG write.`;
    console.error(`[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] ${msg}`);
    return { successCount: 0, errorCount: mentions.length, errors: [msg] };
  }

  console.log(`[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] Preparing to write one mention: ID ${firstValidMention.id}, Title: "${firstValidMention.title?.substring(0,30)}..." for user '${userId}'.`);

  const mentionDocRef = doc(db, 'users', userId, GLOBAL_MENTIONS_SUBCOLLECTION, firstValidMention.id);
  console.log(`[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] Firestore document path for single write: ${mentionDocRef.path}`);

  const mentionDataToSave = {
    id: String(firstValidMention.id),
    platform: String(firstValidMention.platform || 'Unknown') as Mention['platform'],
    source: String(firstValidMention.source || 'Unknown Source'),
    title: String(firstValidMention.title || 'No Title Provided'),
    excerpt: String(firstValidMention.excerpt || 'No Excerpt Provided'),
    url: String(firstValidMention.url || '#'),
    timestamp: (firstValidMention.timestamp instanceof Date)
               ? firstValidMention.timestamp.toISOString()
               : String(firstValidMention.timestamp || new Date().toISOString()),
    matchedKeyword: String(firstValidMention.matchedKeyword || 'general'),
    sentiment: firstValidMention.sentiment && ['positive', 'negative', 'neutral', 'unknown'].includes(firstValidMention.sentiment)
               ? firstValidMention.sentiment
               : 'unknown',
    fetchedAt: serverTimestamp(),
  };

  try {
    console.log(`[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] Attempting setDoc for mention ID ${firstValidMention.id} for user '${userId}'. Data (first 200 chars): ${JSON.stringify(mentionDataToSave).substring(0, 200)}...`);
    await setDoc(mentionDocRef, mentionDataToSave, { merge: true });
    console.log(`[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] SUCCESS: setDoc completed for mention ID ${firstValidMention.id} for user '${userId}'.`);
    successCount = 1; 
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown setDoc error.';
    console.error(`[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] FAILURE: Error during setDoc for mention ID ${firstValidMention.id} (user '${userId}'). Error: ${errorMessage}`, error);
    
    if (error instanceof Error) {
        console.error(`[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] FAILURE DETAILS: Name: ${error.name}, Stack: ${error.stack}`);
        if ('code' in error) { // Check if it's a FirebaseError
            console.error(`[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] FAILURE FirebaseError Code: ${(error as any).code}`);
        }
    } else if (error && typeof error === 'object') {
        console.error('[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] Non-standard error object details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } else {
         console.error('[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] Non-standard, non-object error:', error);
    }
    localErrors.push(`DEBUG Write Failed for ${firstValidMention.id}: ${errorMessage}`);
  }
  
  const skippedCount = mentions.length - 1; // All other mentions are skipped in this debug version
  if (skippedCount > 0) {
      localErrors.push(`${skippedCount} other mentions were skipped in this DEBUG version.`);
  }

  console.log(`[GlobalMentionsService (addGlobalMentionsBatch) DEBUG] Returning. Success: ${successCount}, Errors: ${localErrors.length}, Skipped (not attempted): ${skippedCount}, Error Messages: ${localErrors.join('; ')}`);
  return { successCount, errorCount: localErrors.length, errors: localErrors };
}
