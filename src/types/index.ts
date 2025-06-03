
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
  sentiment?: 'positive' | 'neutral' | 'negative' | 'unknown';
}

export interface RedditPost {
  id:string; // Fullname from Reddit API (e.g., t3_xxxxxx or t1_yyyyyy)
  sno?: number; // Client-side serial number for table display
  title: string; // For posts: post title. For comments: title of the post the comment is on (link_title)
  content?: string; // For posts: selftext. For comments: comment body.
  subreddit: string;
  author: string;
  timestamp: string; // ISO date string
  score: number;
  numComments: number; // Primarily for posts. For comments, this might be 0 or link to post's comment count.
  url: string; // For posts: post URL. For comments: comment permalink.
  flair?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'unknown';
  type: 'Post' | 'Comment'; 
  matchedKeyword?: string; // Keyword that this post/comment matched
  processedAt?: string; // ISO string timestamp of when this item was last processed/saved
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
  render?: (item: T, index?: number) => React.ReactNode; // Custom render function for a cell
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

// Search parameters for Reddit API
export interface RedditSearchParams {
  q: string; // query string
  limit?: number; // number of items to return
  sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments'; // sort order
  t?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'; // time period for 'top' or 'relevance'
  after?: string; // fullname of an item to
}
