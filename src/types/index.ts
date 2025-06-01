
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  name: string;
  profilePictureUrl?: string;
  assignedKeywords?: string[]; // For filtering data for 'user' role
}

export interface YoutubeVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  channelTitle?: string; // Added for context
  url: string;
  assignedToUserId?: string; // New field for user assignment
  dataAiHint?: string;
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
