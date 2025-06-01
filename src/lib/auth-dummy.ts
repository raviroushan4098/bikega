import type { User } from '@/types';

export const DUMMY_USERS: User[] = [
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
