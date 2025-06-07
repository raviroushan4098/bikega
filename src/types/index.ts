
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

export interface YouTubeMentionItem {
  id: string; // Video ID
  url: string; // Link to video
  title: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string; // ISO date string
  descriptionSnippet?: string; // A short snippet from description showing keyword context
  matchedKeywords: string[];
  dataAiHint?: string;
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
  flair?: string | null; // Flair can be a string or null (if not present or explicitly set to null)
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
  id: string; // Should be unique across platforms, e.g., platform_originalId
  userId: string; // ID of the user this mention belongs to
  platform: 'Reddit' | 'Hacker News' | 'Twitter/X' | 'Google News' | 'Web Mention' | 'Other';
  source: string; // e.g., "Reddit r/webdev", "Hacker News", "TechCrunch", "My Awesome Blog"
  title: string;
  excerpt: string;
  url: string;
  timestamp: string; // ISO date string (publication time)
  sentiment?: 'positive' | 'neutral' | 'negative' | 'unknown'; // Matching AdvancedSentimentOutput
  matchedKeyword: string; // The keyword that triggered this mention
  fetchedAt?: string; // ISO date string (when our system fetched it)
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

// Types for External Reddit User Analysis
export interface ExternalRedditUserAnalysisInput {
  username: string;
  appUserId?: string; // ID of the app user initiating the analysis, for saving results
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
  username: string;
  accountCreated: string | null; // ISO string or null
  totalPostKarma: number;
  totalCommentKarma: number;
  subredditsPostedIn: string[];
  totalPostsFetchedThisRun: number;
  totalCommentsFetchedThisRun: number;
  fetchedPostsDetails: ExternalRedditUserDataItem[];
  fetchedCommentsDetails: ExternalRedditUserDataItem[];
  lastRefreshedAt?: string | null; // ISO string, can be null if pending
  _placeholder?: boolean; // True if this is just a placeholder, not a full analysis
  error?: string; // Optional error message if analysis failed
}

