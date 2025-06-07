
'use server';

import { db } from './firebase';
import { collection, addDoc, getDocs, query, Timestamp, orderBy, serverTimestamp, doc, setDoc, where, writeBatch, limit } from 'firebase/firestore';
import type { Mention } from '@/types';

const GLOBAL_MENTIONS_COLLECTION_NAME = 'globalMentions'; // Changed from subcollection

/**
 * Adds or updates a global mention in the top-level 'globalMentions' collection.
 * It uses the provided mention.id as the document ID.
 * The mention object MUST already contain the userId.
 */
export async function addOrUpdateGlobalMention(mention: Mention): Promise<string | { error: string }> {
  if (!mention.userId || typeof mention.userId !== 'string' || mention.userId.trim() === "") {
    const msg = 'Mention object must contain a valid userId.';
    console.error(`[GlobalMentionsService (addOrUpdateGlobalMention)] ${msg}`);
    return { error: msg };
  }
  if (!mention.id || typeof mention.id !== 'string' || mention.id.trim() === "") {
    const msg = 'Mention ID is required and must be a non-empty string for storing.';
    console.error(`[GlobalMentionsService (addOrUpdateGlobalMention)] ${msg}`);
    return { error: msg };
  }

  console.log(`[GlobalMentionsService (addOrUpdateGlobalMention)] UserID: ${mention.userId}, MentionID: ${mention.id}, Title: "${mention.title?.substring(0,30)}..."`);
  try {
    const mentionDocRef = doc(db, GLOBAL_MENTIONS_COLLECTION_NAME, mention.id);
    
    const mentionDataToSave = {
      // Ensure all fields from Mention type are present and correctly typed
      id: String(mention.id),
      userId: String(mention.userId),
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
    
    await setDoc(mentionDocRef, mentionDataToSave, { merge: true }); 
    console.log(`[GlobalMentionsService (addOrUpdateGlobalMention)] Successfully Added/Updated mention '${mention.id}' in '${GLOBAL_MENTIONS_COLLECTION_NAME}' for user '${mention.userId}'.`);
    return mention.id;
  } catch (error) {
    console.error(`[GlobalMentionsService (addOrUpdateGlobalMention)] Error adding/updating mention '${mention.id}' for user '${mention.userId}' in '${GLOBAL_MENTIONS_COLLECTION_NAME}':`, error);
    if (error instanceof Error) {
      return { error: `Failed to add/update mention: ${error.message}` };
    }
    return { error: 'An unknown error occurred while adding/updating mention.' };
  }
}

/**
 * Fetches all global mentions for a given user from the top-level 'globalMentions' collection, 
 * ordered by timestamp descending.
 * REQUIRES a Firestore index on (userId ==, timestamp desc) for the 'globalMentions' collection.
 */
export async function getGlobalMentionsForUser(userId: string): Promise<Mention[]> {
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    console.warn('[GlobalMentionsService (getGlobalMentionsForUser)] Invalid or missing userId provided. Received:', userId);
    return [];
  }
  const mentionsCollectionPath = GLOBAL_MENTIONS_COLLECTION_NAME;
  console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Fetching global mentions for user ${userId} from top-level collection: '${mentionsCollectionPath}'.`);
  try {
    const mentionsCollectionRef = collection(db, GLOBAL_MENTIONS_COLLECTION_NAME);
    const q = query(mentionsCollectionRef, where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(100)); 
    
    const querySnapshot = await getDocs(q);
    console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Firestore query for user '${userId}' (collection: ${mentionsCollectionRef.path}) returned ${querySnapshot.docs.length} raw documents.`);

    if (querySnapshot.empty) {
      console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] No documents found for user '${userId}' in '${GLOBAL_MENTIONS_COLLECTION_NAME}'. This might be due to missing data or a required Firestore index (on userId, timestamp desc).`);
      return [];
    }

    const mentions = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      // if (docSnap.id === querySnapshot.docs[0].id) { 
      //     // console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Raw data for first doc ID ${docSnap.id} (User ${userId}): ${JSON.stringify(data)}`);
      // }
      return {
        ...data,
        id: docSnap.id,
        userId: String(data.userId || 'unknown_user_id'), // Should always be present
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
    console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Successfully mapped ${mentions.length} mentions for user ${userId} from '${GLOBAL_MENTIONS_COLLECTION_NAME}'.`);
    return mentions;
  } catch (error) {
    console.error(`[GlobalMentionsService (getGlobalMentionsForUser)] Error fetching global mentions for user ${userId} from '${GLOBAL_MENTIONS_COLLECTION_NAME}':`, error);
    if (error instanceof Error && (error.message.includes(' benötigt einen Index') || error.message.includes('needs an index') || error.message.includes('requires an index'))) {
        console.error(`[GlobalMentionsService (getGlobalMentionsForUser)] Firestore index missing for query. Please create a composite index on the '${GLOBAL_MENTIONS_COLLECTION_NAME}' collection for fields (userId ASC, timestamp DESC). The error message from Firestore should contain a direct link to create it.`);
    }
    return [];
  }
}

/**
 * Adds a batch of global mentions to the top-level 'globalMentions' collection in Firestore.
 * Each mention object in the 'mentions' array MUST already contain the 'userId'.
 * It uses the provided mention.id as the document ID for each mention.
 */
export async function addGlobalMentionsBatch(mentions: Mention[]): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
  console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] Attempting to process ${mentions.length} mentions for top-level '${GLOBAL_MENTIONS_COLLECTION_NAME}' collection.`);

  if (!mentions || mentions.length === 0) {
    console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] No mentions provided. Nothing to store.`);
    return { successCount: 0, errorCount: 0, errors: [] };
  }

  const batch = writeBatch(db);
  const localErrors: string[] = [];
  let itemsInBatch = 0;
  let skippedCount = 0;

  for (const mention of mentions) {
    if (!mention.userId || typeof mention.userId !== 'string' || mention.userId.trim() === "") {
      const skipMsg = `Skipping mention due to missing or invalid userId. Title: "${mention.title?.substring(0,30)}...", ID: ${mention.id}.`;
      console.warn(`[GlobalMentionsService (addGlobalMentionsBatch)] ${skipMsg}`);
      localErrors.push(skipMsg);
      skippedCount++;
      continue;
    }
    if (!mention.id || typeof mention.id !== 'string' || mention.id.trim() === "") {
      const skipMsg = `Skipping mention due to missing or invalid ID. Title: "${mention.title?.substring(0,30)}..." for user '${mention.userId}'.`;
      console.warn(`[GlobalMentionsService (addGlobalMentionsBatch)] ${skipMsg}`);
      localErrors.push(skipMsg);
      skippedCount++;
      continue;
    }

    const mentionDocRef = doc(db, GLOBAL_MENTIONS_COLLECTION_NAME, mention.id);
    if (itemsInBatch === 0) { // Log path only for the first item in batch for brevity
      console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] First document path (example): ${mentionDocRef.path}`);
    }

    const mentionDataToSave = {
      id: String(mention.id),
      userId: String(mention.userId), // Ensured by check above
      platform: String(mention.platform || 'Unknown') as Mention['platform'],
      source: String(mention.source || 'Unknown Source'),
      title: String(mention.title || 'No Title Provided'),
      excerpt: String(mention.excerpt || 'No Excerpt Provided'),
      url: String(mention.url || '#'),
      timestamp: (mention.timestamp instanceof Date)
                 ? mention.timestamp.toISOString()
                 : String(mention.timestamp || new Date().toISOString()),
      matchedKeyword: String(mention.matchedKeyword || 'general'),
      sentiment: mention.sentiment && ['positive', 'negative', 'neutral', 'unknown'].includes(mention.sentiment)
                 ? mention.sentiment
                 : 'unknown',
      fetchedAt: serverTimestamp(),
    };
    batch.set(mentionDocRef, mentionDataToSave, { merge: true });
    itemsInBatch++;
  }

  if (itemsInBatch === 0) {
    const finalMsg = `No valid mentions to commit to '${GLOBAL_MENTIONS_COLLECTION_NAME}'. Total initially: ${mentions.length}, Skipped: ${skippedCount}.`;
    console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] ${finalMsg}`);
    if(localErrors.length > 0) console.warn(`[GlobalMentionsService (addGlobalMentionsBatch)] Errors for skipped items: ${localErrors.join('; ')}`);
    return { successCount: 0, errorCount: localErrors.length, errors: localErrors };
  }

  console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] Attempting to commit batch with ${itemsInBatch} mentions to '${GLOBAL_MENTIONS_COLLECTION_NAME}'. Initial total: ${mentions.length}, Skipped ${skippedCount}.`);
  try {
    await batch.commit();
    console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] SUCCESS: Batch committed ${itemsInBatch} mentions to '${GLOBAL_MENTIONS_COLLECTION_NAME}'.`);
    return { successCount: itemsInBatch, errorCount: localErrors.length, errors: localErrors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown batch.commit error.';
    console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] FAILURE: Error committing batch to '${GLOBAL_MENTIONS_COLLECTION_NAME}'. Error: ${errorMessage}`, error);
    
    if (error instanceof Error) {
        console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] FAILURE DETAILS: Name: ${error.name}, Stack: ${error.stack}`);
        if ('code' in error) { 
            console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] FAILURE FirebaseError Code: ${(error as any).code}`);
            if ((error as any).code === 'failed-precondition' && error.message.includes('needs an index')) {
                console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] Firestore index missing. The operation likely requires a composite index. Check the error message for a link to create it.`);
            }
        }
    } else if (error && typeof error === 'object') {
        console.error('[GlobalMentionsService (addGlobalMentionsBatch)] Non-standard error object details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } else {
         console.error('[GlobalMentionsService (addGlobalMentionsBatch)] Non-standard, non-object error:', error);
    }
    localErrors.push(`Batch Commit Failed: ${errorMessage}`);
    return { successCount: 0, errorCount: itemsInBatch + localErrors.length, errors: localErrors };
  }
}
