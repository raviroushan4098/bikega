
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import type { ColumnConfig, RedditPost } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { searchReddit, RedditSearchParams } from '@/lib/reddit-api-service';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';

const columns: ColumnConfig<RedditPost>[] = [
  { key: 'title', header: 'Post Title', sortable: true, className: "min-w-[250px] font-medium" },
  { key: 'subreddit', header: 'Subreddit', sortable: true, className: "w-[150px]" },
  { key: 'author', header: 'Author', sortable: true, className: "w-[150px]" },
  {
    key: 'timestamp',
    header: 'Timestamp',
    sortable: true,
    render: (item) => formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }),
    className: "w-[180px]"
  },
  {
    key: 'score',
    header: 'Score',
    sortable: true,
    render: (item) => item.score.toLocaleString(),
    className: "text-right w-[100px]"
  },
  {
    key: 'numComments',
    header: 'Comments',
    sortable: true,
    render: (item) => item.numComments.toLocaleString(),
    className: "text-right w-[120px]"
  },
  {
    key: 'flair',
    header: 'Flair',
    render: (item) => item.flair ? <Badge variant="secondary">{item.flair}</Badge> : '-',
    className: "w-[120px]"
  },
];

export default function RedditAnalyticsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [redditData, setRedditData] = useState<RedditPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentQuery, setCurrentQuery] = useState('');

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() && currentUser?.role !== 'admin') { // Prevent empty search unless admin
        if(currentUser?.role === 'user' && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0) {
            // If user clears search, re-search their assigned keywords
            const userKeywordsQuery = currentUser.assignedKeywords.join(' ');
            setSearchTerm(userKeywordsQuery);
            setCurrentQuery(userKeywordsQuery);
            return;
        }
        toast({ variant: 'default', title: 'Enter a search term', description: 'Please type something to search for on Reddit.' });
        setRedditData([]);
        return;
    }
    if (!query.trim() && currentUser?.role === 'admin') {
        setRedditData([]); // Clear data for admin if search is empty
        setCurrentQuery('');
        return;
    }

    setIsLoading(true);
    setCurrentQuery(query);
    try {
      const params: RedditSearchParams = { q: query, limit: 25 };
      const results = await searchReddit(params);
      if (results.error) {
        toast({ variant: "destructive", title: "API Error", description: results.error });
        setRedditData([]);
      } else {
        setRedditData(results.data || []);
        if (!results.data || results.data.length === 0) {
          toast({ variant: 'default', title: 'No Results', description: `No Reddit posts found for "${query}".` });
        }
      }
    } catch (error) {
      console.error("Error fetching Reddit data:", error);
      toast({ variant: "destructive", title: "Search Error", description: "Failed to fetch data from Reddit." });
      setRedditData([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast, currentUser]);

  useEffect(() => {
    if (!authLoading && currentUser) {
      if (currentUser.role === 'user' && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0) {
        const userKeywordsQuery = currentUser.assignedKeywords.join(' ');
        setSearchTerm(userKeywordsQuery); // Pre-fill search bar
        handleSearch(userKeywordsQuery); // Perform initial search
      } else if (currentUser.role === 'admin') {
        // For admin, no initial search, allow them to type.
        // If there was a previous query in state (e.g. from navigation), it could be re-run here
        // but for now, let's start fresh for admins.
        setRedditData([]);
      }
    }
  }, [currentUser, authLoading, handleSearch]);


  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch(searchTerm);
  };
  
  if (authLoading && !currentUser) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DataTableShell
      title="Reddit Analytics"
      description={
        currentUser?.role === 'user' && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0
        ? `Showing posts related to your assigned keywords: ${currentUser.assignedKeywords.join(', ')}. You can also search for other terms.`
        : "Monitor Reddit posts. Admins can search by keywords."
      }
    >
      <form onSubmit={onSearchSubmit} className="mb-6 flex gap-2">
        <Input
          type="search"
          placeholder={
            currentUser?.role === 'user' && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0
            ? `Searching: ${currentUser.assignedKeywords.join(' ')} (or type new query)`
            : "Search Reddit by keyword (e.g., Next.js, AI)"
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow bg-background shadow-sm"
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || (!searchTerm.trim() && currentUser?.role !== 'admin' && !(currentUser?.role === 'user' && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0 && !searchTerm.trim()))}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Search
        </Button>
      </form>

      {isLoading && currentQuery ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <p className="text-muted-foreground">Searching Reddit for "{currentQuery}"...</p>
        </div>
      ) : (
        <GenericDataTable<RedditPost>
          data={redditData}
          columns={columns}
          caption={currentQuery ? `Reddit posts for "${currentQuery}"` : "Reddit Post Data"}
        />
      )}
    </DataTableShell>
  );
}
