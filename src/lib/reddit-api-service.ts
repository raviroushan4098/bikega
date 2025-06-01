
'use server';

import type { RedditPost } from '@/types';
// We don't actually need an API key for basic Reddit search via JSON

export interface RedditSearchParams {
  q: string; // Search query
  limit?: number;
  sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments'; // default is relevance
  t?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'; // time period for top/hot, default is all
  subreddit?: string; // Optional: to search within a specific subreddit
}

interface RedditApiResponseChildData {
  title: string;
  subreddit_name_prefixed: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  permalink: string;
  link_flair_text?: string | null;
  id: string;
  selftext: string; // The body of the post, if it's a text post
  url: string; // URL of the post itself, or the link if it's a link post
  thumbnail?: string; // URL to thumbnail
}

interface RedditApiResponseChild {
  kind: string;
  data: RedditApiResponseChildData;
}

interface RedditApiResponseData {
  after: string | null;
  dist: number;
  modhash: string | null;
  geo_filter: string | null;
  children: RedditApiResponseChild[];
  before: string | null;
}

interface RedditApiResponse {
  kind: string;
  data: RedditApiResponseData;
}

export async function searchReddit(
  params: RedditSearchParams
): Promise<{ data: RedditPost[] | null; error?: string }> {
  const { q, limit = 25, sort = 'relevance', t = 'all', subreddit } = params;

  let searchUrl = `https://www.reddit.com/`;
  if (subreddit) {
    searchUrl += `${subreddit.startsWith('r/') ? subreddit : 'r/' + subreddit}/`;
  }
  searchUrl += `search.json?q=${encodeURIComponent(q)}&limit=${limit}&sort=${sort}&t=${t}`;
  
  if (subreddit) {
     searchUrl += `&restrict_sr=true`; // ensure search is within the subreddit
  } else {
     // If no specific subreddit, don't restrict search to one.
     // Some reddit versions might need restrict_sr=false or just omitting it.
     // For global search, omitting or setting to false is usually fine.
  }


  console.log(`[Reddit API Service] Fetching: ${searchUrl}`);

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'InsightStreamApp/1.0 (by /u/yourRedditUsername)', // Good practice to set a User-Agent
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Reddit API Service] API Error (${response.status}): ${errorText}`);
      return { data: null, error: `Reddit API Error (${response.status}): ${response.statusText}` };
    }

    const rawData: RedditApiResponse = await response.json();

    if (!rawData || !rawData.data || !rawData.data.children) {
        console.error("[Reddit API Service] Unexpected API response structure:", rawData);
        return { data: null, error: "Unexpected response structure from Reddit API." };
    }

    const posts: RedditPost[] = rawData.data.children.map(child => ({
      id: child.data.id,
      title: child.data.title,
      subreddit: child.data.subreddit_name_prefixed,
      author: child.data.author,
      timestamp: new Date(child.data.created_utc * 1000).toISOString(),
      score: child.data.score,
      numComments: child.data.num_comments,
      url: `https://www.reddit.com${child.data.permalink}`,
      flair: child.data.link_flair_text || undefined,
    }));

    return { data: posts };
  } catch (error) {
    console.error('[Reddit API Service] Fetch Error:', error);
    if (error instanceof Error) {
      return { data: null, error: `Network or parsing error: ${error.message}` };
    }
    return { data: null, error: 'An unknown error occurred while fetching from Reddit.' };
  }
}
