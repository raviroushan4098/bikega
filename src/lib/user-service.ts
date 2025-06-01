
import type { User } from '@/types';
import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// Collection reference
const usersCollectionRef = collection(db, 'users');

export const login = async (email: string, passwordInput: string): Promise<User | null> => {
  // Firestore doesn't handle password verification directly without Firebase Auth.
  // This login remains simplified: find user by email.
  // In a real app, use Firebase Authentication.
  try {
    const q = query(usersCollectionRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('No user found with that email.');
      return null;
    }

    // Assuming email is unique, take the first match
    const userDoc = querySnapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() } as User;
    
    // Dummy password check placeholder - in real app, Firebase Auth handles this.
    // For this step, if email matches, consider login successful.
    // You might want to add a console warning here about the dummy password check.
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    return user;
  } catch (error) {
    console.error("Error logging in user:", error);
    return null;
  }
};

export const logout = async (): Promise<void> => {
  // For Firebase Auth, you would call signOut(auth)
  // For this Firestore-only data setup, no server-side logout action is needed beyond client-side state clearing.
  await new Promise(resolve => setTimeout(resolve, 300));
};

export interface NewUserDetails {
  name: string;
  email: string;
  password?: string; // Password handling is dummy in this Firestore-only setup
  role: 'admin' | 'user';
}

export const addUser = async (userData: NewUserDetails): Promise<User | { error: string }> => {
  try {
    // Check if email already exists
    const q = query(usersCollectionRef, where('email', '==', userData.email));
    const emailCheckSnapshot = await getDocs(q);
    if (!emailCheckSnapshot.empty) {
      return { error: "Email already exists." };
    }

    const newUserDocRef = doc(usersCollectionRef); // Auto-generate ID

    const newUser: Omit<User, 'id'> = {
      email: userData.email,
      name: userData.name,
      role: userData.role,
      profilePictureUrl: `https://placehold.co/100x100.png?text=${userData.name.substring(0,2)}`,
      assignedKeywords: userData.role === 'admin'
        ? ['technology', 'AI', 'startup', 'innovation', 'finance']
        : [],
      // createdAt: serverTimestamp(), // Optional: add a timestamp
    };
    
    await setDoc(newUserDocRef, newUser);

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
      console.log("No such user document!");
      return null;
    }
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return null;
  }
};
