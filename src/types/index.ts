
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  name: string;
  profilePictureUrl?: string;
  assignedKeywords?: string[]; // For filtering data for 'user' role
  assignedYoutubeUrls?: string[]; // Array of YouTube video URLs
  createdAt?: string; // ISO date string for when the user was created
}

// Represents video details fetched from YouTube API for display
export interface YoutubeVideo {
  id: string; // YouTube Video ID
  url: string;
  title?: string;
  thumbnailUrl?: string;
  dataAiHint?: string;
  channelTitle?: string;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
  shareCount?: number; // Note: shareCount is often not available or zero from API
  assignedToUserId: string; // User to whom this URL is assigned
  assignedToUserName?: string; // Optional: Name of the user for display
  sentiment?: 'positive' | 'neutral' | 'negative'; // Added for placeholder sentiment
}

export interface RedditPost {
  id:string;
  title: string;
  subreddit: string;
  author: string;
  timestamp: string; // ISO date string
  score: number;
  numComments: number;
  url: string;
  flair?: string;
}

export interface Tweet {
  id: string;
  text: string;
  author: string;
  authorAvatarUrl?: string;
  timestamp: string; // ISO date string
  commentsOrRepliesCount: number;
  retweetCount: number;
  likeCount: number;
  url: string;
}

export interface Mention {
  id: string;
  source: string; // e.g., "News Outlet X", "Blog Y"
  title: string;
  excerpt: string;
  url: string;
  timestamp: string; // ISO date string
  sentiment?: 'positive' | 'neutral' | 'negative';
}

// For table column definitions
export interface ColumnConfig<T> {
  key: keyof T | string; // Allow string for custom/action columns
  header: string;
  render?: (item: T) => React.ReactNode; // Custom render function for a cell
  sortable?: boolean;
  className?: string; // Optional className for th/td
}

export interface ApiKey {
  id: string;
  serviceName: string;
  keyValue: string; // SECURITY NOTE: Storing raw API keys readable by client is risky for production.
  description?: string;
  createdAt: string; // ISO date string
  addedByUserId: string;
}

export interface NewApiKeyData {
  serviceName: string;
  keyValue: string;
  description?: string;
  addedByUserId: string;
}

export interface NewUserDetails {
  name: string;
  email: string;
  password?: string; // Password handling is dummy in this Firestore-only setup
  role: 'admin' | 'user';
  assignedKeywords?: string; // Comma-separated string
}

