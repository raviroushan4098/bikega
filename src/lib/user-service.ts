
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

    // CRITICAL: Compare the input password with the stored password
    if (user.password !== passwordInput) {
      console.warn(`Login Failed: Password mismatch for user '${email}'. Input: '${passwordInput}', Stored: '${user.password}'`);
      return null;
    }

    console.log(`Login Succeeded: User '${email}' found in Firestore with ID '${user.id}'.`);
    // Simulate network delay if needed, but often not necessary here
    // await new Promise(resolve => setTimeout(resolve, 500)); 
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

    const newUser: Omit<User, 'id' | 'createdAt'> & { createdAt: Timestamp } = { // Ensure createdAt is a Firestore Timestamp
      email: userData.email,
      password: userData.password,
      name: userData.name,
      role: userData.role,
      profilePictureUrl: `https://placehold.co/100x100.png?text=${userData.name.substring(0,2)}`,
      assignedKeywords: keywordsArray,
      assignedYoutubeUrls: [],
      createdAt: Timestamp.now(), // Use Firestore Timestamp
    };

    await setDoc(newUserDocRef, newUser);
    console.log(`[user-service] Added user with ID: ${newUserDocRef.id}, Email: ${userData.email}, Keywords: ${keywordsArray.join(', ')}, CreatedAt: ${newUser.createdAt.toDate().toISOString()}`);
    return { id: newUserDocRef.id, ...newUser, createdAt: newUser.createdAt.toDate().toISOString() };

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
    const users = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        passwordLastResetAt: data.passwordLastResetAt instanceof Timestamp ? data.passwordLastResetAt.toDate().toISOString() : data.passwordLastResetAt,
      } as User;
    });
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
      const data = userDocSnap.data();
      return {
        id: userDocSnap.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        passwordLastResetAt: data.passwordLastResetAt instanceof Timestamp ? data.passwordLastResetAt.toDate().toISOString() : data.passwordLastResetAt,
      } as User;
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
      password: newPassword, 
      passwordLastResetAt: Timestamp.now(),
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
