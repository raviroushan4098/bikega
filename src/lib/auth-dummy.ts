
import type { User } from '@/types';

// Changed DUMMY_USERS to let so it can be mutated for this mock setup
export let DUMMY_USERS: User[] = [
  { 
    id: '1', 
    email: 'admin@insightstream.com', 
    role: 'admin', 
    name: 'Adminstrator', 
    profilePictureUrl: 'https://placehold.co/100x100.png',
    assignedKeywords: ['technology', 'AI', 'startup', 'innovation', 'finance'] 
  },
  { 
    id: '2', 
    email: 'user@insightstream.com', 
    role: 'user', 
    name: 'Content Analyst', 
    profilePictureUrl: 'https://placehold.co/100x100.png',
    assignedKeywords: ['AI', 'innovation'] 
  },
  {
    id: '3',
    email: 'admin123@gmail.com',
    role: 'admin',
    name: 'New Admin',
    profilePictureUrl: 'https://placehold.co/100x100.png',
    assignedKeywords: ['nextjs', 'tailwindcss', 'typescript', 'ai', 'analytics']
  },
  {
    id: '4',
    email: 'user123@gmail.com',
    role: 'user',
    name: 'New User',
    profilePictureUrl: 'https://placehold.co/100x100.png',
    assignedKeywords: ['tailwindcss', 'analytics']
  }
];

export const login = async (email: string, passwordInput: string): Promise<User | null> => {
  // In a real app, passwordInput would be compared against a hashed password.
  // For this dummy version, we're not checking the password.
  const user = DUMMY_USERS.find(u => u.email === email);
  if (user) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return user;
  }
  return null;
};

export const logout = async (): Promise<void> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
};

export interface NewUserDetails {
  name: string;
  email: string;
  password?: string; // Password is used for creation, not stored directly on User object in this dummy setup
  role: 'admin' | 'user';
}

export const addUser = async (userData: NewUserDetails): Promise<User | { error: string }> => {
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API delay
  if (DUMMY_USERS.some(u => u.email === userData.email)) {
    return { error: "Email already exists." };
  }
  const newUser: User = {
    id: String(DUMMY_USERS.length + 1 + Date.now()), // simple unique ID
    email: userData.email,
    name: userData.name,
    role: userData.role,
    profilePictureUrl: `https://placehold.co/100x100.png?text=${userData.name.substring(0,2)}`,
    assignedKeywords: userData.role === 'admin' 
      ? ['technology', 'AI', 'startup', 'innovation', 'finance'] 
      : [], // Default keywords
  };
  DUMMY_USERS.push(newUser);
  return newUser;
};

export const getUsers = async (): Promise<User[]> => {
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay
  return [...DUMMY_USERS]; // Return a copy
};
