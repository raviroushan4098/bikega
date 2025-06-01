
import type { User } from '@/types';

const LOCAL_STORAGE_USERS_KEY = 'insightStreamAllUsers';

// Initial seed users. This will be used if localStorage is empty.
const SEED_USERS: User[] = [
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

const getStoredUsers = (): User[] => {
  if (typeof window === 'undefined') {
    return [...SEED_USERS];
  }
  try {
    const storedUsers = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    if (storedUsers) {
      return JSON.parse(storedUsers) as User[];
    } else {
      // Initialize localStorage with seed users if it's empty
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(SEED_USERS));
      return [...SEED_USERS];
    }
  } catch (error) {
    console.error("Error accessing localStorage for users:", error);
    return [...SEED_USERS]; // Fallback to seed users on error
  }
};

const saveStoredUsers = (users: User[]): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (error) {
    console.error("Error saving users to localStorage:", error);
  }
};

export const login = async (email: string, passwordInput: string): Promise<User | null> => {
  const users = getStoredUsers();
  const user = users.find(u => u.email === email);
  // Password check is still dummy for this prototype
  if (user) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return user;
  }
  return null;
};

export const logout = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 300));
};

export interface NewUserDetails {
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'user';
}

export const addUser = async (userData: NewUserDetails): Promise<User | { error: string }> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const currentUsers = getStoredUsers();

  if (currentUsers.some(u => u.email === userData.email)) {
    return { error: "Email already exists." };
  }

  const newUser: User = {
    id: String(currentUsers.length + 1 + Date.now()),
    email: userData.email,
    name: userData.name,
    role: userData.role,
    profilePictureUrl: `https://placehold.co/100x100.png?text=${userData.name.substring(0,2)}`,
    assignedKeywords: userData.role === 'admin'
      ? ['technology', 'AI', 'startup', 'innovation', 'finance']
      : [],
  };

  const updatedUsers = [...currentUsers, newUser];
  saveStoredUsers(updatedUsers);
  return newUser;
};

export const getUsers = async (): Promise<User[]> => {
  await new Promise(resolve => setTimeout(resolve, 100));
  return getStoredUsers();
};

// This export is for the auth-context to validate a stored user session.
// It should also check against the potentially updated localStorage list.
export const DUMMY_USERS_FOR_SESSION_VALIDATION = () => getStoredUsers();
