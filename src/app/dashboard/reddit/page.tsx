
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import type { ColumnConfig, RedditPost } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Rss } from 'lucide-react'; // Using Rss as a more generic feed icon
import { searchReddit, RedditSearchParams } from '@/lib/reddit-api-service';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const columns: ColumnConfig<RedditPost>[] = [
  { 
    key: 'subreddit', 
    header: 'Subreddit', 
    sortable: true, 
    className: "w-[180px] font-medium",
    render: (item) => <Badge variant="secondary">{item.subreddit}</Badge>
  },
  { key: 'title', header: 'Title', sortable: true, className: "min-w-[300px]" },
  { key: 'author', header: 'Author', sortable: true, className: "w-[150px]" },
  { 
    key: 'timestamp', 
    header: 'Date', 
    sortable: true, 
    render: (item) => formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }),
    className: "w-[180px]"
  },
  { 
    key: 'score', 
    header: 'Score', 
    sortable: true, 
    render: (item) => <span className="text-right block">{item.score.toLocaleString()}</span>,
    className: "text-right w-[100px]"
  },
  { 
    key: 'numComments', 
    header: 'Comments', 
    sortable: true, 
    render: (item) => <span className="text-right block">{item.numComments.toLocaleString()}</span>,
    className: "text-right w-[120px]"
  },
  { 
    key: 'flair', 
    header: 'Flair',
    render: (item) => item.flair ? <Badge variant="outline">{item.flair}</Badge> : <span className="text-muted-foreground text-xs">N/A</span>,
    className: "w-[120px]"
  },
];

export default function RedditAnalyticsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [redditPosts, setRedditPosts] = useState<RedditPost[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [displayedSearchTerm, setDisplayedSearchTerm] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      toast({ variant: "destructive", title: "Search term required", description: "Please enter a keyword to search Reddit." });
      setRedditPosts([]);
      setDisplayedSearchTerm(null);
      return;
    }
    setIsLoading(true);
    setDisplayedSearchTerm(query);
    try {
      const { data, error } = await searchReddit({ q: query, limit: 25, sort: 'relevance' });
      if (error) {
        toast({ variant: "destructive", title: "Reddit Search Failed", description: error });
        setRedditPosts([]);
      } else if (data) {
        setRedditPosts(data);
        if (data.length === 0) {
          toast({ title: "No Results", description: `No Reddit posts found for "${query}".` });
        }
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred during Reddit search." });
      setRedditPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (!authLoading && currentUser) {
      if (currentUser.role === 'user' && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0) {
        const userKeywordsQuery = currentUser.assignedKeywords.join(' OR '); // Using OR for broader results
        setSearchTerm(userKeywordsQuery);
        handleSearch(userKeywordsQuery);
      } else {
        // For admins, or users with no keywords, clear previous results
        setRedditPosts([]);
        setDisplayedSearchTerm(null);
      }
    }
  }, [currentUser, authLoading, handleSearch]);

  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch(searchTerm);
  };

  if (authLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DataTableShell
      title="Reddit Keyword Monitoring"
      description={
        currentUser?.role === 'user' && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0
          ? `Showing posts related to your keywords: "${currentUser.assignedKeywords.join(', ')}". You can search for other terms below.`
          : "Search for Reddit posts by keyword. Admins can search any term; users' feeds are pre-loaded if keywords are assigned."
      }
    >
      <form onSubmit={onSearchSubmit} className="mb-6 flex items-center gap-2">
        <Input
          type="search"
          placeholder="Enter keywords to search Reddit (e.g., Next.js, AI)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow bg-background shadow-sm"
          aria-label="Search Reddit Posts"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Search
        </Button>
      </form>

      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Fetching Reddit posts for "{displayedSearchTerm || searchTerm}"...</p>
        </div>
      )}

      {!isLoading && displayedSearchTerm && redditPosts.length === 0 && (
        <div className="text-center py-10">
          <Rss className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-lg font-semibold">No Reddit Posts Found</p>
          <p className="text-muted-foreground">
            No posts matched your search for "{displayedSearchTerm}". Try different keywords.
          </p>
        </div>
      )}

      {!isLoading && !displayedSearchTerm && redditPosts.length === 0 && currentUser?.role === 'admin' && (
         <div className="text-center py-10">
            <Rss className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-semibold">Ready to Search Reddit</p>
            <p className="text-muted-foreground">Enter keywords above to find relevant posts.</p>
        </div>
      )}
       {!isLoading && !displayedSearchTerm && redditPosts.length === 0 && currentUser?.role === 'user' && (!currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0) && (
         <div className="text-center py-10">
            <Rss className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-semibold">No Assigned Keywords</p>
            <p className="text-muted-foreground">You don't have any keywords assigned. Please enter terms to search or contact an admin.</p>
        </div>
      )}


      {!isLoading && redditPosts.length > 0 && (
        <GenericDataTable<RedditPost>
          data={redditPosts}
          columns={columns}
          caption={displayedSearchTerm ? `Showing Reddit posts related to "${displayedSearchTerm}"` : "Reddit Posts"}
        />
      )}
    </DataTableShell>
  );
}

    