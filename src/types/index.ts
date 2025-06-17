export interface User {
  id: string;
  email: string;
  password?: string; 
  role: 'admin' | 'user';
  name: string;
  profilePictureUrl?: string;
  assignedKeywords?: string[]; 
  assignedYoutubeUrls?: string[]; 
  assignedRssFeedUrls?: string[]; // New field for RSS feed URLs
  createdAt?: string; 
  passwordLastResetAt?: string; 
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
  shareCount?: number; 
  assignedToUserId: string; 
  assignedToUserName?: string; 
  sentiment?: 'positive' | 'neutral' | 'negative' | 'unknown';
}

export interface YouTubeMentionItem {
  id: string; // Video ID
  url: string; // Link to video
  title: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string; // ISO date string
  descriptionSnippet?: string; 
  matchedKeywords: string[];
  dataAiHint?: string;
  userId: string; 
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'unknown'; 
}

export interface RedditPost {
  id:string; 
  sno?: number; 
  title: string; 
  content?: string; 
  subreddit: string;
  author: string;
  timestamp: string; // ISO date string
  score: number;
  numComments: number; 
  url: string; 
  flair?: string | null; 
  sentiment?: 'positive' | 'neutral' | 'negative' | 'unknown';
  type: 'Post' | 'Comment';
  matchedKeyword?: string; 
  processedAt?: string; 
}

export interface Tweet {
  id: string;
  text: string;
  author: string;
  authorAvatarUrl?: string;
  dataAiHint?: string;
  timestamp: string; // ISO date string
  commentsOrRepliesCount: number;
  retweetCount: number;
  likeCount: number;
  url: string;
}

export interface RssEntry {
  id: string;
  title: string;
  link: string;
  published: string;
  updated: string;
  content: string;
  author?: string;
}

export interface Mention {
  id: string;
  xmlContent: string; // The raw XML entry content
  createdAt: Date;
  platform: 'Reddit' | 'Hacker News' | 'Twitter/X' | 'Google News' | 'Web Mention' | 'RSS Feed' | 'Other'; // Added 'RSS Feed'
  source: string; 
  title: string;
  excerpt: string;
  url: string;
  timestamp: string; // ISO date string (publication time)
  sentiment?: 'positive' | 'neutral' | 'negative' | 'unknown'; 
  matchedKeyword: string; 
  fetchedAt?: string; 
  rssEntry?: RssEntry; // Add this field
}

// For table column definitions
export interface ColumnConfig<T> {
  key: keyof T | string; 
  header: string;
  render?: (item: T, index?: number) => React.ReactNode; 
  sortable?: boolean;
  className?: string; 
}

export interface ApiKey {
  id: string;
  serviceName: string;
  keyValue: string; 
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

// This type is used by the User Management (Add User) form and the user-service
export interface NewUserDetails {
  name: string;
  email: string;
  password?: string; 
  role: 'admin' | 'user';
  assignedKeywords?: string; 
  assignedRssFeedUrls?: string; // New field for form input
}

// Types for External Reddit User Analysis
export interface ExternalRedditUserAnalysisInput {
  username: string;
  appUserId?: string; 
}

export interface ExternalRedditUserDataItem {
  id: string;
  titleOrContent: string;
  subreddit: string;
  timestamp: string; // ISO string
  score: number;
  numComments?: number; // Only for posts
  url: string;
  type: 'Post' | 'Comment'; // Added field
}

export interface ExternalRedditUserAnalysis {
  username:string;
  accountCreated: string | null; // ISO string or null
  totalPostKarma: number;
  totalCommentKarma: number;
  subredditsPostedIn: string[];
  totalPostsFetchedThisRun: number;
  totalCommentsFetchedThisRun: number;
  fetchedPostsDetails: ExternalRedditUserDataItem[];
  fetchedCommentsDetails: ExternalRedditUserDataItem[];
  lastRefreshedAt?: string | null; 
  _placeholder?: boolean; 
  error?: string; 
  suspensionStatus?: string; 
  lastErrorAt?: string; 
}
