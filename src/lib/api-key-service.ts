
'use server';

import { db } from './firebase';
import { collection, addDoc, getDocs, query, Timestamp, orderBy, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import type { ApiKey, NewApiKeyData } from '@/types';

const API_KEYS_COLLECTION = 'api_keys';

/**
 * Adds a new API key to Firestore.
 * SECURITY NOTE: Storing raw API keys in Firestore that might be fetched by a client
 * (even an admin client) is a security risk for sensitive keys.
 * Consider using a dedicated secrets manager for production.
 */
export async function addApiKey(apiKeyData: NewApiKeyData): Promise<ApiKey | { error: string }> {
  try {
    const createdAt = Timestamp.now();
    const docRef = doc(collection(db, API_KEYS_COLLECTION)); // Auto-generate ID

    const newApiKeyForDb = {
      ...apiKeyData,
      createdAt: createdAt,
    };

    await setDoc(docRef, newApiKeyForDb);

    return {
      id: docRef.id,
      ...apiKeyData,
      createdAt: createdAt.toDate().toISOString(),
    };
  } catch (error) {
    console.error("Error adding API key to Firestore: ", error);
    if (error instanceof Error) {
      return { error: `Failed to add API key: ${error.message}` };
    }
    return { error: "An unknown error occurred while adding API key." };
  }
}

/**
 * Fetches all API keys from Firestore.
 * Intended for admin use.
 */
export async function getApiKeys(): Promise<ApiKey[]> {
  try {
    const apiKeysCollectionRef = collection(db, API_KEYS_COLLECTION);
    const q = query(apiKeysCollectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const apiKeys = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        serviceName: data.serviceName,
        keyValue: data.keyValue, // Displaying this in UI, be cautious
        description: data.description,
        addedByUserId: data.addedByUserId,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      } as ApiKey;
    });
    return apiKeys;
  } catch (error) {
    console.error("Error fetching API keys from Firestore: ", error);
    return [];
  }
}
