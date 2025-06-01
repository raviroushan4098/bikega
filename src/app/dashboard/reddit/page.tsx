
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import type { ColumnConfig, RedditPost, User } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { searchReddit, RedditSearchParams } from '@/lib/reddit-api-service';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { getUsers } from '@/lib/user-service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';

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

  // For admin user selection
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedUserIdForFilter, setSelectedUserIdForFilter] = useState<string>(''); // 'all' or user_id

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setRedditData([]);
      setCurrentQuery('');
      // Optionally, show a toast if the user manually submitted an empty search
      // For auto-clears (e.g., admin deselects user), this might be too noisy.
      // if (currentQuery) { // only toast if there was a previous query
      //   toast({ variant: 'default', title: 'Search Cleared', description: 'Enter a term or select a user to search Reddit.' });
      // }
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
  }, [toast]);

  // Fetch all users if current user is admin
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      setIsLoadingUsers(true);
      getUsers()
        .then(users => {
          setAllUsers(users);
        })
        .catch(error => {
          console.error("Failed to fetch users for admin dropdown:", error);
          toast({ variant: "destructive", title: "Error", description: "Failed to fetch users list." });
        })
        .finally(() => setIsLoadingUsers(false));
    }
  }, [currentUser?.role, toast]);

  // Effect for initial load and when admin selects a user
  useEffect(() => {
    if (authLoading || !currentUser) {
      setSearchTerm('');
      setRedditData([]);
      setCurrentQuery('');
      return;
    }

    let queryToRun = '';
    let prefillSearchTermValue = '';

    if (currentUser.role === 'admin') {
      if (selectedUserIdForFilter && selectedUserIdForFilter !== 'all' && allUsers.length > 0) {
        const selectedUser = allUsers.find(u => u.id === selectedUserIdForFilter);
        if (selectedUser?.assignedKeywords && selectedUser.assignedKeywords.length > 0) {
          queryToRun = selectedUser.assignedKeywords.join(' ');
          prefillSearchTermValue = queryToRun;
        } else {
           // Admin selected a user, but that user has no keywords
           prefillSearchTermValue = ''; // Clear search bar
        }
      } else {
        // Admin hasn't selected a user, or 'all' is selected, or users not loaded
        prefillSearchTermValue = '';
      }
    } else { // User role
      if (currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0) {
        queryToRun = currentUser.assignedKeywords.join(' ');
        prefillSearchTermValue = queryToRun;
      } else {
        // Regular user has no assigned keywords
        prefillSearchTermValue = '';
      }
    }
    
    setSearchTerm(prefillSearchTermValue);

    if (queryToRun) {
      handleSearch(queryToRun);
    } else {
      // No automatic query to run (clear data if it was from a previous state)
      setRedditData([]);
      setCurrentQuery('');
    }
  }, [currentUser, authLoading, selectedUserIdForFilter, allUsers, handleSearch]);


  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // If searchTerm is empty, handleSearch will clear results.
    // If searchTerm is not empty, handleSearch will perform the search.
    handleSearch(searchTerm);
  };
  
  if (authLoading && !currentUser) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const getPageDescription = () => {
    if (currentUser?.role === 'admin') {
      return "Monitor Reddit. Select a user to view posts based on their assigned keywords, or search manually.";
    }
    if (currentUser?.assignedKeywords && currentUser.assignedKeywords.length > 0) {
      return `Showing posts related to your assigned keywords: ${currentUser.assignedKeywords.join(', ')}. You can also search for other terms.`;
    }
    return "Monitor Reddit posts. Ask an admin to assign keywords for a personalized feed.";
  };


  return (
    <DataTableShell
      title="Reddit Analytics"
      description={getPageDescription()}
    >
      {currentUser?.role === 'admin' && (
        <div className="mb-4 flex items-center gap-2">
            <Label htmlFor="user-select-filter-reddit" className="text-sm font-medium shrink-0">View keyword feed for:</Label>
            {isLoadingUsers && allUsers.length === 0 ? (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users...
              </div>
            ) : (
              <Select
                value={selectedUserIdForFilter}
                onValueChange={(value) => setSelectedUserIdForFilter(value === 'all' ? '' : value)}
              >
                <SelectTrigger id="user-select-filter-reddit" className="w-full sm:w-[280px] bg-background shadow-sm">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Search Manually / All Posts</SelectItem>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
      )}

      <form onSubmit={onSearchSubmit} className="mb-6 flex gap-2">
        <Input
          type="search"
          placeholder={
             currentUser?.role === 'admin' && searchTerm 
                ? `Searching: "${searchTerm}" (for selected user or manual query)`
             : currentUser?.role === 'admin' 
                ? "Search Reddit by keyword or select a user"
             : currentUser?.assignedKeywords && currentUser.assignedKeywords.length > 0 && searchTerm
                ? `Searching your keywords: "${searchTerm}" (or type new query)`
                : "Search Reddit by keyword (e.g., Next.js, AI)"
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow bg-background shadow-sm"
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading}>
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

