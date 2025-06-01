
import type { User, NewUserDetails as NewUserDetailsType } from '@/types'; // Renamed import to avoid conflict
import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

// Collection reference
const usersCollectionRef = collection(db, 'users');

export const login = async (email: string, passwordInput: string): Promise<User | null> => {
  try {
    console.log(`Login attempt for email: ${email}`);
    const q = query(usersCollectionRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn(`Login Failed: No user found in Firestore with email '${email}'.
      Please check:
      1. The email is spelled correctly.
      2. The user exists in your Firestore 'users' collection.
      3. If you used the seed script (src/scripts/seed-initial-users.ts), ensure it ran successfully and populated the data.`);
      return null;
    }

    const userDoc = querySnapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() } as User;

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

// Use the renamed import for NewUserDetails type
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
      name: userData.name,
      role: userData.role,
      profilePictureUrl: `https://placehold.co/100x100.png?text=${userData.name.substring(0,2)}`,
      assignedKeywords: keywordsArray,
    };

    await setDoc(newUserDocRef, newUser);
    console.log(`[user-service] Added user with ID: ${newUserDocRef.id}, Email: ${userData.email}, Keywords: ${keywordsArray.join(', ')}`);
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
    console.log("[user-service] getUsers fetched users (ID, Name, Email, Keywords):", users.map(u => ({ id: u.id, name: u.name, email: u.email, keywords: u.assignedKeywords })));
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
