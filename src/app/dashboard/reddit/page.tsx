
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import type { ColumnConfig, RedditPost } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Rss } from 'lucide-react'; 
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
      // For users with keywords, this might not be an error, just initial state.
      // Only toast if it's a manual search attempt with no query.
      if(currentUser?.role === 'admin' || !currentUser?.assignedKeywords || currentUser.assignedKeywords.length === 0) {
        toast({ variant: "destructive", title: "Search term required", description: "Please enter a keyword to search Reddit." });
      }
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
  }, [toast, currentUser]); // Added currentUser to dependency array for role check in toast
  
  useEffect(() => {
    if (!authLoading && currentUser) {
      if (currentUser.role === 'user' && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0) {
        const userKeywordsQuery = currentUser.assignedKeywords.join(' OR ');
        setSearchTerm(userKeywordsQuery); // Pre-fill for consistency, though input might be hidden
        handleSearch(userKeywordsQuery);
      } else {
        // For admins, or users with no keywords, clear previous results if any.
        // This allows admins to start with a clean slate.
        // Users without keywords will see the search bar and can initiate search.
        if (currentUser.role === 'admin') {
            setRedditPosts([]);
            setDisplayedSearchTerm(null);
            setSearchTerm(''); // Clear admin search term on load
        }
      }
    }
  }, [currentUser, authLoading, handleSearch]);

  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch(searchTerm);
  };

  const canUserSearch = currentUser?.role === 'admin' || 
                        (currentUser?.role === 'user' && (!currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0));

  let pageDescription = "Monitor Reddit posts by keyword.";
  if (currentUser?.role === 'user' && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0) {
    pageDescription = `Showing posts related to your keywords: "${currentUser.assignedKeywords.join(', ')}".`;
  } else if (currentUser?.role === 'admin') {
    pageDescription = "Search for Reddit posts by keyword. Results will appear below.";
  } else if (currentUser?.role === 'user' && (!currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0)) {
    pageDescription = "You have no assigned keywords. Enter terms below to search Reddit.";
  }


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
      description={pageDescription}
    >
      {canUserSearch && (
        <form onSubmit={onSearchSubmit} className="mb-6 flex items-center gap-2">
          <Input
            type="search"
            placeholder="Enter keywords to search Reddit (e.g., Next.js, AI)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow bg-background shadow-sm"
            aria-label="Search Reddit Posts"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !searchTerm.trim()}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Search
          </Button>
        </form>
      )}

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
      
      {/* Initial state for admin or user without keywords before any search */}
      {!isLoading && !displayedSearchTerm && redditPosts.length === 0 && canUserSearch && (
         <div className="text-center py-10">
            <Rss className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-semibold">
              {currentUser?.role === 'admin' ? "Ready to Search Reddit" : "Search for Reddit Posts"}
            </p>
            <p className="text-muted-foreground">
              {currentUser?.role === 'admin' 
                ? "Enter keywords above to find relevant posts."
                : "Enter keywords in the search bar above to find relevant posts."
              }
            </p>
        </div>
      )}

      {/* For users with assigned keywords, if initial load yields no results (but displayedSearchTerm is set) */}
       {!isLoading && displayedSearchTerm && redditPosts.length === 0 && 
        currentUser?.role === 'user' && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0 && (
        <div className="text-center py-10">
          <Rss className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-lg font-semibold">No Reddit Posts Found for Your Keywords</p>
          <p className="text-muted-foreground">
            No posts matched your assigned keywords: "{displayedSearchTerm}".
          </p>
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
