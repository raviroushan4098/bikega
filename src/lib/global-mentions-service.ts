
'use server';

import { db } from './firebase';
import { collection, getDocs, query, Timestamp, orderBy, serverTimestamp, doc, setDoc, where, writeBatch, limit } from 'firebase/firestore';
import type { Mention } from '@/types';

const TOP_LEVEL_GLOBAL_MENTIONS_COLLECTION_NAME = 'globalMentions';
const MENTIONS_SUBCOLLECTION_NAME = 'mentions';

/**
 * Adds or updates a global mention in the user's specific subcollection.
 * Path: globalMentions/{userId}/mentions/{mentionId}
 * The mention object itself does not strictly need userId for path construction here,
 * but it's good for the Mention type to have it.
 */
export async function addOrUpdateGlobalMention(userId: string, mention: Mention): Promise<string | { error: string }> {
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    const msg = '[GlobalMentionsService (addOrUpdateGlobalMention)] Invalid or missing userId provided.';
    console.error(msg);
    return { error: msg };
  }
  if (!mention.id || typeof mention.id !== 'string' || mention.id.trim() === "") {
    const msg = '[GlobalMentionsService (addOrUpdateGlobalMention)] Mention ID is required and must be a non-empty string for storing.';
    console.error(`${msg} For user: ${userId}. Mention title: "${mention.title?.substring(0,30)}..."`);
    return { error: msg };
  }

  console.log(`[GlobalMentionsService (addOrUpdateGlobalMention)] UserID: ${userId}, MentionID: ${mention.id}, Title: "${mention.title?.substring(0,30)}..."`);
  try {
    const mentionDocRef = doc(db, TOP_LEVEL_GLOBAL_MENTIONS_COLLECTION_NAME, userId, MENTIONS_SUBCOLLECTION_NAME, mention.id);
    
    const mentionDataToSave = {
      id: String(mention.id),
      userId: String(userId), // Ensure userId from param is stored if mention.userId is different/missing
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
    console.log(`[GlobalMentionsService (addOrUpdateGlobalMention)] Successfully Added/Updated mention '${mention.id}' in '${mentionDocRef.path}'.`);
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
 * Fetches all global mentions for a given user from their subcollection.
 * Path: globalMentions/{userId}/mentions
 * REQUIRES a Firestore index on (timestamp desc) for the 'mentions' subcollection.
 */
export async function getGlobalMentionsForUser(userId: string): Promise<Mention[]> {
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    console.warn('[GlobalMentionsService (getGlobalMentionsForUser)] Invalid or missing userId provided. Received:', userId);
    return [];
  }
  const mentionsSubcollectionPath = `${TOP_LEVEL_GLOBAL_MENTIONS_COLLECTION_NAME}/${userId}/${MENTIONS_SUBCOLLECTION_NAME}`;
  console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Fetching global mentions for user ${userId} from subcollection: '${mentionsSubcollectionPath}'.`);
  
  try {
    const mentionsCollectionRef = collection(db, TOP_LEVEL_GLOBAL_MENTIONS_COLLECTION_NAME, userId, MENTIONS_SUBCOLLECTION_NAME);
    const q = query(mentionsCollectionRef, orderBy('timestamp', 'desc'), limit(100)); 
    
    const querySnapshot = await getDocs(q);
    console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Firestore query for user '${userId}' (subcollection: ${mentionsCollectionRef.path}) returned ${querySnapshot.docs.length} raw documents.`);

    if (querySnapshot.empty) {
      console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] No documents found for user '${userId}' in subcollection '${mentionsSubcollectionPath}'. This might be due to missing data or a required Firestore index (on timestamp desc for this subcollection).`);
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
        userId: String(userId), // The userId is known from the path
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
    console.log(`[GlobalMentionsService (getGlobalMentionsForUser)] Successfully mapped ${mentions.length} mentions for user ${userId} from '${mentionsSubcollectionPath}'.`);
    return mentions;
  } catch (error) {
    console.error(`[GlobalMentionsService (getGlobalMentionsForUser)] Error fetching global mentions for user ${userId} from '${mentionsSubcollectionPath}':`, error);
    if (error instanceof Error && (error.message.includes(' benötigt einen Index') || error.message.includes('needs an index') || error.message.includes('requires an index'))) {
        console.error(`[GlobalMentionsService (getGlobalMentionsForUser)] Firestore index missing for query. Please create an index on the '${MENTIONS_SUBCOLLECTION_NAME}' subcollection for field 'timestamp' (descending). The error message from Firestore should contain a direct link to create it.`);
    }
    return [];
  }
}

/**
 * Adds a batch of global mentions to the user's specific subcollection in Firestore.
 * Path: globalMentions/{userId}/mentions/{mentionId}
 */
export async function addGlobalMentionsBatch(userId: string, mentions: Mention[]): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
  if (!userId || typeof userId !== 'string' || userId.trim() === "") {
    const msg = '[GlobalMentionsService (addGlobalMentionsBatch)] Invalid or missing userId provided. Batch cannot proceed.';
    console.error(msg);
    return { successCount: 0, errorCount: mentions.length, errors: [msg] };
  }
  const subcollectionPath = `${TOP_LEVEL_GLOBAL_MENTIONS_COLLECTION_NAME}/${userId}/${MENTIONS_SUBCOLLECTION_NAME}`;
  console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] Attempting to process ${mentions.length} mentions for user '${userId}' into subcollection '${subcollectionPath}'.`);

  if (!mentions || mentions.length === 0) {
    console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] No mentions provided for user '${userId}'. Nothing to store.`);
    return { successCount: 0, errorCount: 0, errors: [] };
  }

  const batch = writeBatch(db);
  const localErrors: string[] = [];
  let itemsInBatch = 0;
  let skippedCount = 0;

  for (const mention of mentions) {
    if (!mention.id || typeof mention.id !== 'string' || mention.id.trim() === "") {
      const skipMsg = `Skipping mention due to missing or invalid ID. Title: "${mention.title?.substring(0,30)}..." for user '${userId}'.`;
      console.warn(`[GlobalMentionsService (addGlobalMentionsBatch)] ${skipMsg}`);
      localErrors.push(skipMsg);
      skippedCount++;
      continue;
    }

    const mentionDocRef = doc(db, TOP_LEVEL_GLOBAL_MENTIONS_COLLECTION_NAME, userId, MENTIONS_SUBCOLLECTION_NAME, mention.id);
    if (itemsInBatch === 0) { // Log path only for the first item in batch for brevity
      console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] First document path (example): ${mentionDocRef.path}`);
    }

    const mentionDataToSave = {
      id: String(mention.id),
      userId: String(userId), // Ensure userId from param is stored
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
    const finalMsg = `No valid mentions to commit for user '${userId}' to '${subcollectionPath}'. Total initially: ${mentions.length}, Skipped: ${skippedCount}.`;
    console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] ${finalMsg}`);
    if(localErrors.length > 0) console.warn(`[GlobalMentionsService (addGlobalMentionsBatch)] Errors for skipped items for user '${userId}': ${localErrors.join('; ')}`);
    return { successCount: 0, errorCount: localErrors.length, errors: localErrors };
  }

  console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] Attempting to commit batch with ${itemsInBatch} mentions for user '${userId}' to '${subcollectionPath}'. Initial total: ${mentions.length}, Skipped ${skippedCount}.`);
  try {
    await batch.commit();
    console.log(`[GlobalMentionsService (addGlobalMentionsBatch)] SUCCESS: Batch committed ${itemsInBatch} mentions for user '${userId}' to '${subcollectionPath}'.`);
    return { successCount: itemsInBatch, errorCount: localErrors.length, errors: localErrors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown batch.commit error.';
    console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] FAILURE: Error committing batch for user '${userId}' to '${subcollectionPath}'. Error: ${errorMessage}`, error);
    
    if (error instanceof Error) {
        console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] FAILURE DETAILS (User '${userId}'): Name: ${error.name}, Stack: ${error.stack}`);
        if ('code' in error) { 
            console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] FAILURE FirebaseError Code (User '${userId}'): ${(error as any).code}`);
            if ((error as any).code === 'failed-precondition' && error.message.includes('needs an index')) {
                console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] Firestore index missing. The operation likely requires a composite index on the '${MENTIONS_SUBCOLLECTION_NAME}' subcollection. Check the error message for a link to create it.`);
            }
        }
    } else if (error && typeof error === 'object') {
        console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] Non-standard error object details (User '${userId}'):`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } else {
         console.error(`[GlobalMentionsService (addGlobalMentionsBatch)] Non-standard, non-object error (User '${userId}'):`, error);
    }
    localErrors.push(`Batch Commit Failed for user '${userId}': ${errorMessage}`);
    return { successCount: 0, errorCount: itemsInBatch + localErrors.length - skippedCount, errors: localErrors };
  }
}

