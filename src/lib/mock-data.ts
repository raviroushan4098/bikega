import type { YoutubeVideo, RedditPost, Tweet, Mention, User } from '@/types';

const now = new Date();
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

export const mockYoutubeVideos: YoutubeVideo[] = [
  {
    id: 'yt1',
    title: 'Next.js 15: The Future of Web Development',
    thumbnailUrl: 'https://placehold.co/320x180.png',
    dataAiHint: 'technology code',
    likeCount: 12500,
    commentCount: 850,
    shareCount: 1200,
    channelTitle: 'Tech Explained',
    url: 'https://www.youtube.com/watch?v=example1'
  },
  {
    id: 'yt2',
    title: 'AI in 2024: Breakthroughs and Challenges',
    thumbnailUrl: 'https://placehold.co/320x180.png',
    dataAiHint: 'artificial intelligence',
    likeCount: 25000,
    commentCount: 1500,
    shareCount: 3000,
    channelTitle: 'Future AI',
    url: 'https://www.youtube.com/watch?v=example2'
  },
  {
    id: 'yt3',
    title: 'Mastering Tailwind CSS: A Comprehensive Guide',
    thumbnailUrl: 'https://placehold.co/320x180.png',
    dataAiHint: 'web design',
    likeCount: 9800,
    commentCount: 420,
    shareCount: 950,
    channelTitle: 'Dev Tutorials',
    url: 'https://www.youtube.com/watch?v=example3'
  },
  {
    id: 'yt4',
    title: 'The Rise of Server Components in React',
    thumbnailUrl: 'https://placehold.co/320x180.png',
    dataAiHint: 'programming react',
    likeCount: 7600,
    commentCount: 310,
    shareCount: 600,
    channelTitle: 'React Insights',
    url: 'https://www.youtube.com/watch?v=example4'
  },
];

export const mockRedditPosts: RedditPost[] = [
  {
    id: 'rd1',
    title: 'Discussion: Is Next.js the ultimate React framework for new projects in 2024?',
    subreddit: 'r/webdev',
    author: 'nextjsfan123',
    timestamp: now.toISOString(),
    score: 1250,
    numComments: 302,
    url: 'https://www.reddit.com/r/webdev/comments/example1',
    flair: 'Discussion'
  },
  {
    id: 'rd2',
    title: 'Showoff: I built a social media dashboard using Next.js and Tailwind CSS!',
    subreddit: 'r/reactjs',
    author: 'prouddev007',
    timestamp: oneDayAgo.toISOString(),
    score: 870,
    numComments: 150,
    url: 'https://www.reddit.com/r/reactjs/comments/example2',
    flair: 'Showoff Saturday'
  },
  {
    id: 'rd3',
    title: 'What are your favorite AI tools for productivity? Looking for recommendations.',
    subreddit: 'r/artificialintelligence',
    author: 'AI_explorer',
    timestamp: twoDaysAgo.toISOString(),
    score: 2100,
    numComments: 560,
    url: 'https://www.reddit.com/r/artificialintelligence/comments/example3',
    flair: 'Question'
  },
  {
    id: 'rd4',
    title: 'The impact of Large Language Models (LLMs) on software development careers.',
    subreddit: 'r/cscareerquestions',
    author: 'future_coder',
    timestamp: oneWeekAgo.toISOString(),
    score: 950,
    numComments: 220,
    url: 'https://www.reddit.com/r/cscareerquestions/comments/example4',
    flair: 'Career Growth'
  },
  {
    id: 'rd5',
    title: 'Seeking advice on scaling a Next.js application with a PostgreSQL database.',
    subreddit: 'r/nextjs',
    author: 'scale_master',
    timestamp: now.toISOString(),
    score: 450,
    numComments: 88,
    url: 'https://www.reddit.com/r/nextjs/comments/example5',
    flair: 'Help'
  },
];

export const mockTweets: Tweet[] = [
  {
    id: 'tw1',
    text: 'Just deployed my new #NextJS app to Vercel! The developer experience is amazing. #webdev #react',
    author: '@happycoder',
    authorAvatarUrl: 'https://placehold.co/48x48.png',
    dataAiHint: 'coding computer',
    timestamp: now.toISOString(),
    commentsOrRepliesCount: 25,
    retweetCount: 150,
    likeCount: 560,
    url: 'https://twitter.com/happycoder/status/example1'
  },
  {
    id: 'tw2',
    text: 'Exploring the latest advancements in #AI and #MachineLearning. The pace of innovation is mind-blowing! 🤯',
    author: '@AIenthusiast',
    authorAvatarUrl: 'https://placehold.co/48x48.png',
    dataAiHint: 'robot technology',
    timestamp: oneDayAgo.toISOString(),
    commentsOrRepliesCount: 75,
    retweetCount: 320,
    likeCount: 1200,
    url: 'https://twitter.com/AIenthusiast/status/example2'
  },
  {
    id: 'tw3',
    text: 'What are your go-to resources for staying updated with #TailwindCSS best practices? Always looking to learn. #css #uidesign',
    author: '@designlearner',
    authorAvatarUrl: 'https://placehold.co/48x48.png',
    dataAiHint: 'design web',
    timestamp: twoDaysAgo.toISOString(),
    commentsOrRepliesCount: 40,
    retweetCount: 80,
    likeCount: 350,
    url: 'https://twitter.com/designlearner/status/example3'
  },
  {
    id: 'tw4',
    text: 'Server Components in Next.js are a game changer for performance. Highly recommend diving into them. #reactjs #performance',
    author: '@performantdev',
    authorAvatarUrl: 'https://placehold.co/48x48.png',
    dataAiHint: 'speed fast',
    timestamp: oneWeekAgo.toISOString(),
    commentsOrRepliesCount: 15,
    retweetCount: 95,
    likeCount: 410,
    url: 'https://twitter.com/performantdev/status/example4'
  },
];

export const mockMentions: Mention[] = [
  {
    id: 'mn1',
    source: 'TechCrunch',
    title: 'Insight Stream secures $5M in seed funding for its innovative analytics platform',
    excerpt: 'The startup aims to revolutionize how businesses track social media engagement with its AI-powered dashboard...',
    url: 'https://techcrunch.com/insight-stream-funding',
    timestamp: now.toISOString(),
    sentiment: 'positive',
  },
  {
    id: 'mn2',
    source: 'Dev.to Community',
    title: 'Building a Real-time Analytics Dashboard with Next.js: A Case Study',
    excerpt: 'Inspired by platforms like Insight Stream, I decided to build my own version to track project metrics...',
    url: 'https://dev.to/user/analytics-dashboard-nextjs',
    timestamp: oneDayAgo.toISOString(),
    sentiment: 'neutral',
  },
  {
    id: 'mn3',
    source: 'Hacker News Forum',
    title: 'Ask HN: Best tools for social media monitoring in 2024?',
    excerpt: 'Someone mentioned Insight Stream, has anyone tried it? Looking for alternatives to Brandwatch...',
    url: 'https://news.ycombinator.com/item?id=example3',
    timestamp: twoDaysAgo.toISOString(),
    sentiment: 'neutral',
  },
  {
    id: 'mn4',
    source: 'Forbes Technology Council',
    title: 'The Future of Social Analytics: AI, Automation, and Insight Stream',
    excerpt: 'Companies like Insight Stream are paving the way for more intelligent data analysis in the social media landscape...',
    url: 'https://www.forbes.com/sites/technologycouncil/social-analytics-future',
    timestamp: oneWeekAgo.toISOString(),
    sentiment: 'positive',
  },
];

// Function to filter data based on user role and keywords
export const getFilteredData = <T extends { title?: string; text?: string; excerpt?: string }>(
  data: T[],
  user: User | null
): T[] => {
  if (!user) return [];
  if (user.role === 'admin') return data;

  if (user.role === 'user' && user.assignedKeywords && user.assignedKeywords.length > 0) {
    return data.filter(item => {
      const content = `${item.title || ''} ${item.text || ''} ${item.excerpt || ''}`.toLowerCase();
      return user.assignedKeywords!.some(keyword => content.includes(keyword.toLowerCase()));
    });
  }
  return data; // Default to all data if user has no specific keywords
};
