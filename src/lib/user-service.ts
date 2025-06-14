
import type { User, NewUserDetails as NewUserDetailsType } from '@/types';
import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, Timestamp } from 'firebase/firestore'; // Added Timestamp

const usersCollectionRef = collection(db, 'users');

export const login = async (email: string, passwordInput: string): Promise<User | null> => {
  try {
    console.log(`Login attempt for email: ${email}`);
    const q = query(usersCollectionRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn(`Login Failed: No user found in Firestore with email '${email}'.`);
      return null;
    }

    const userDoc = querySnapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() } as User;

    // Conceptual password check
    // In a real app, compare hashed passwords. Here, we compare plaintext.
    if (user.password !== passwordInput) {
      console.warn(`Login Failed: Password mismatch for user '${email}'.`);
      return null;
    }

    console.log(`Login Succeeded: User '${email}' found in Firestore with ID '${user.id}'.`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return user;
  } catch (error) {
    console.error(`Login Failed: Error querying Firestore for email '${email}'. Error Details:`, error);
    return null;
  }
};

export const logout = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 300));
};

export interface NewUserDetails extends NewUserDetailsType {}

export const addUser = async (userData: NewUserDetails): Promise<User | { error: string }> => {
  try {
    const q = query(usersCollectionRef, where('email', '==', userData.email));
    const emailCheckSnapshot = await getDocs(q);
    if (!emailCheckSnapshot.empty) {
      return { error: "Email already exists." };
    }

    const newUserDocRef = doc(usersCollectionRef);

    let keywordsArray: string[] = [];
    if (userData.assignedKeywords && userData.assignedKeywords.trim() !== "") {
      keywordsArray = userData.assignedKeywords.split(',').map(k => k.trim()).filter(k => k !== "");
    } else {
      keywordsArray = userData.role === 'admin'
        ? ['technology', 'AI', 'startup', 'innovation', 'finance']
        : [];
    }

    const newUser: Omit<User, 'id'> = {
      email: userData.email,
      password: userData.password, // Store the password (conceptually)
      name: userData.name,
      role: userData.role,
      profilePictureUrl: `https://placehold.co/100x100.png?text=${userData.name.substring(0,2)}`,
      assignedKeywords: keywordsArray,
      assignedYoutubeUrls: [],
      createdAt: new Date().toISOString(),
    };

    await setDoc(newUserDocRef, newUser);
    console.log(`[user-service] Added user with ID: ${newUserDocRef.id}, Email: ${userData.email}, Keywords: ${keywordsArray.join(', ')}, CreatedAt: ${newUser.createdAt}`);
    return { id: newUserDocRef.id, ...newUser };

  } catch (error) {
    console.error("Error adding user to Firestore: ", error);
    if (error instanceof Error) {
      return { error: `Failed to add user: ${error.message}` };
    }
    return { error: "An unknown error occurred while adding user." };
  }
};

export const getUsers = async (): Promise<User[]> => {
  try {
    const querySnapshot = await getDocs(usersCollectionRef);
    const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    // console.log("[user-service] getUsers fetched users (ID, Name, Email, Keywords, YouTube URLs, CreatedAt):", users.map(u => ({ id: u.id, name: u.name, email: u.email, keywords: u.assignedKeywords, youtubeUrls: u.assignedYoutubeUrls, createdAt: u.createdAt })));
    return users;
  } catch (error) {
    console.error("Error fetching users from Firestore: ", error);
    return [];
  }
};

export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      return { id: userDocSnap.id, ...userDocSnap.data() } as User;
    } else {
      console.log(`[user-service] No such user document with ID: ${userId}`);
      return null;
    }
  } catch (error) {
    console.error(`[user-service] Error fetching user by ID (${userId}):`, error);
    return null;
  }
};

export const updateUserKeywords = async (userId: string, keywords: string[]): Promise<{ success: boolean; error?: string }> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      assignedKeywords: keywords
    });
    console.log(`[user-service] Successfully updated keywords for user ${userId} to: ${keywords.join(', ')}`);
    return { success: true };
  } catch (error) {
    console.error(`[user-service] Error updating keywords for user ${userId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: `Failed to update keywords: ${error.message}` };
    }
    return { success: false, error: "An unknown error occurred while updating keywords." };
  }
};

export const assignYoutubeUrlToUser = async (userId: string, videoUrl: string): Promise<{ success: boolean; error?: string }> => {
  if (!userId || !videoUrl) {
    return { success: false, error: "User ID and Video URL are required." };
  }
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      assignedYoutubeUrls: arrayUnion(videoUrl)
    });
    console.log(`[user-service] Assigned YouTube URL "${videoUrl}" to user ${userId}.`);
    return { success: true };
  } catch (error) {
    console.error(`[user-service] Error assigning YouTube URL to user ${userId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: `Failed to assign URL: ${error.message}` };
    }
    return { success: false, error: "An unknown error occurred while assigning URL." };
  }
};

export const removeYoutubeUrlFromUser = async (userId: string, videoUrl: string): Promise<{ success: boolean; error?: string }> => {
  if (!userId || !videoUrl) {
    return { success: false, error: "User ID and Video URL are required." };
  }
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      assignedYoutubeUrls: arrayRemove(videoUrl)
    });
    console.log(`[user-service] Removed YouTube URL "${videoUrl}" from user ${userId}.`);
    return { success: true };
  } catch (error) {
    console.error(`[user-service] Error removing YouTube URL from user ${userId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: `Failed to remove URL: ${error.message}` };
    }
    return { success: false, error: "An unknown error occurred while removing URL." };
  }
};

/**
 * Updates the user's password in Firestore.
 * For this project, `newPassword` is stored as plaintext.
 * In a real application, newPassword should be securely hashed before storing.
 */
export const updateUserPassword = async (userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
  if (!userId || !newPassword) {
    return { success: false, error: "User ID and new password are required." };
  }
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      password: newPassword, // Store the new password (plaintext for this demo)
      passwordLastResetAt: Timestamp.now(), // Firestore Timestamp
    });
    console.log(`[user-service] Password for user ${userId} has been updated (conceptually).`);
    return { success: true };
  } catch (error) {
    console.error(`[user-service] Error updating password for user ${userId}:`, error);
    if (error instanceof Error) {
      return { success: false, error: `Failed to update password: ${error.message}` };
    }
    return { success: false, error: "An unknown error occurred while updating password." };
  }
};
