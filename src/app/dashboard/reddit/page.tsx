
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import type { ColumnConfig, RedditPost } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, MessageSquare, ArrowUpCircle, CalendarDays } from 'lucide-react'; // Added more icons
import { searchReddit, type RedditSearchParams } from '@/lib/reddit-api-service';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const columns: ColumnConfig<RedditPost>[] = [
  { 
    key: 'title', 
    header: 'Title', 
    sortable: true, 
    render: (item) => (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline font-medium text-primary/90">
        {item.title}
      </a>
    ),
    className: "min-w-[300px]" 
  },
  { 
    key: 'subreddit', 
    header: 'Subreddit', 
    sortable: true, 
    render: (item) => <Badge variant="secondary">{item.subreddit}</Badge>,
    className: "w-[150px]"
  },
  { key: 'author', header: 'Author', sortable: true, className: "w-[150px] text-muted-foreground" },
  { 
    key: 'score', 
    header: 'Score', 
    sortable: true, 
    render: (item) => (
        <div className="flex items-center justify-end gap-1">
            <ArrowUpCircle className="h-3.5 w-3.5 text-orange-500"/>
            {item.score.toLocaleString()}
        </div>
    ),
    className: "text-right w-[100px]" 
  },
  { 
    key: 'numComments', 
    header: 'Comments', 
    sortable: true, 
    render: (item) => (
        <div className="flex items-center justify-end gap-1">
            <MessageSquare className="h-3.5 w-3.5 text-blue-500"/>
            {item.numComments.toLocaleString()}
        </div>
    ),
    className: "text-right w-[120px]"
  },
  { 
    key: 'timestamp', 
    header: 'Date Posted', 
    sortable: true, 
    render: (item) => (
        <div className="flex items-center gap-1 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5"/>
            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
        </div>
    ),
    className: "w-[180px]"
  },
];


export default function RedditAnalyticsPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [displayedSearchTerm, setDisplayedSearchTerm] = useState(''); // For the caption after search
  const [redditPosts, setRedditPosts] = useState<RedditPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Stable handleSearch function that takes the query as an argument
  const handleSearch = useCallback(async (queryToSearch: string) => {
    if (!queryToSearch.trim()) {
      setRedditPosts([]); // Clear posts if search term is effectively empty
      setDisplayedSearchTerm('');
      return;
    }
    setIsLoading(true);
    setRedditPosts([]); // Clear previous results
    setDisplayedSearchTerm(queryToSearch); // Set term used for actual search for caption

    const params: RedditSearchParams = { q: queryToSearch, limit: 25, sort: 'relevance' };
    const { data, error } = await searchReddit(params);

    if (error) {
      toast({ variant: "destructive", title: "Reddit Search Failed", description: error });
      setRedditPosts([]);
    } else if (data) {
      setRedditPosts(data);
      if (data.length === 0) {
        toast({ title: "No Results", description: `No Reddit posts found for "${queryToSearch}".` });
      }
    }
    setIsLoading(false);
  }, [toast]); // Only depends on toast, which is stable

  useEffect(() => {
    const performInitialSearch = async () => {
      if (currentUser?.role === 'user' && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0) {
        const userKeywords = currentUser.assignedKeywords.join(' ');
        setSearchTerm(userKeywords); // Pre-fill search bar for display
        if (userKeywords.trim() !== "") {
          await handleSearch(userKeywords); // Use keywords directly for the search
        }
      } else {
        // For admin, or user with no keywords, ensure posts are cleared if no search term.
        // This handles initial load or if user logs out and another logs in.
        setRedditPosts([]);
        setDisplayedSearchTerm('');
        if (currentUser?.role === 'user' && (!currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0)) {
            setSearchTerm(''); // Clear search bar for user with no keywords
        }
        // For admin, searchTerm is initialized to '' by useState, so it's fine.
      }
    };

    if (currentUser) { // Ensure currentUser is resolved before attempting initial search
      performInitialSearch();
    }
  // `handleSearch` is stable as its only dependency `toast` is stable.
  // This effect should run when `currentUser` changes to set up the initial view.
  }, [currentUser, handleSearch]);

  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchTerm.trim()) { // Check current input field value
      setRedditPosts([]);
      setDisplayedSearchTerm('');
      return;
    }
    handleSearch(searchTerm); // Search using the current input field value
  };

  return (
    <DataTableShell
      title="Reddit Post Tracker"
      description={
        currentUser?.role === 'admin'
          ? "Search public Reddit posts by keyword or topic."
          : "Showing Reddit posts based on your assigned keywords. You can also search for other topics."
      }
    >
      <form onSubmit={onSearchSubmit} className="mb-6 flex items-center gap-3">
        <Input
          type="search"
          placeholder={
            currentUser?.role === 'user' && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0
            ? "Using your keywords. Search for other topics..."
            : "Search Reddit (e.g., 'Next.js features')"
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow bg-background shadow-sm border-border focus:ring-primary focus:border-primary"
          aria-label="Search Reddit posts"
        />
        <Button type="submit" disabled={isLoading} className="shadow-sm">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2">Search</span>
        </Button>
      </form>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
          <p className="text-lg text-muted-foreground">Loading Reddit posts for &quot;{displayedSearchTerm}&quot;...</p>
        </div>
      )}

      {!isLoading && redditPosts.length === 0 && displayedSearchTerm && (
         <p className="text-center text-muted-foreground py-8 text-lg">No posts found for &quot;{displayedSearchTerm}&quot;.</p>
      )}
      
      {!isLoading && redditPosts.length === 0 && !displayedSearchTerm && (
        <>
          {currentUser?.role === 'user' && (!currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0) && (
            <p className="text-center text-muted-foreground py-8 text-lg">You have no assigned keywords. Use the search bar or ask an admin to assign some.</p>
          )}
          {currentUser?.role === 'admin' && (
            <p className="text-center text-muted-foreground py-8 text-lg">Enter a search term to find relevant Reddit posts.</p>
          )}
        </>
      )}


      {!isLoading && redditPosts.length > 0 && (
        <GenericDataTable<RedditPost>
          data={redditPosts}
          columns={columns}
          caption={`Reddit posts related to "${displayedSearchTerm}"`}
        />
      )}
    </DataTableShell>
  );
}
