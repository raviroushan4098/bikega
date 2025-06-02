
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import type { ColumnConfig, RedditPost, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Rss, Users as UsersIcon, Save, ExternalLink, ChevronDown, RefreshCw } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getUsers, updateUserKeywords } from '@/lib/user-service';
import { fetchAndStoreRedditDataForUser, getStoredRedditFeedForUser } from '@/lib/reddit-api-service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const editKeywordsSchema = z.object({
  keywords: z.string().optional(),
});
type EditKeywordsFormValues = z.infer<typeof editKeywordsSchema>;

const redditPostColumnsUserView: ColumnConfig<RedditPost>[] = [
  { 
    key: 'sno', 
    header: 'S.No', 
    className: "w-[60px] text-center",
    render: (item, index) => <span className="text-sm text-muted-foreground">{typeof index === 'number' ? index + 1 : 'N/A'}</span>,
  },
  { 
    key: 'timestamp', 
    header: 'Date', 
    sortable: true, 
    render: (item) => format(new Date(item.timestamp), 'dd-MM-yyyy'),
    className: "w-[120px]"
  },
  {
    key: 'type',
    header: 'Type',
    render: (item) => <Badge variant={item.type === 'Post' ? "secondary" : "outline"}>{item.type}</Badge>,
    className: "w-[100px]"
  },
  { 
    key: 'subreddit', 
    header: 'Subreddit', 
    sortable: true, 
    className: "w-[150px] font-medium",
    render: (item) => <Badge variant="secondary">{item.subreddit}</Badge>
  },
  {
    key: 'matchedKeyword',
    header: 'Keyword',
    render: (item) => item.matchedKeyword ? <Badge variant="outline">{item.matchedKeyword}</Badge> : <span className="text-xs text-muted-foreground">N/A</span>,
    className: "w-[120px]",
  },
  { 
    key: 'title', 
    header: 'Title / Content', 
    sortable: true, 
    className: "min-w-[300px] max-w-md",
    render: (item) => {
      const isPost = item.type === 'Post';
      const displayTitle = item.title || (isPost ? "No Post Title" : "No Parent Post Title");
      const displayContent = item.content || (isPost ? "No post body." : "No comment body.");

      return (
        <Popover>
          <PopoverTrigger asChild>
            <div className="cursor-pointer hover:bg-accent/50 p-1 rounded-sm -m-1">
              <p className="font-semibold text-sm line-clamp-1 text-card-foreground">
                {isPost ? "Post: " : "Comment on: "} {displayTitle}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                 {isPost ? "Content: " : "Comment: "} {displayContent}
              </p>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-96 text-sm">
            <div>
              <p className="font-bold text-base mb-1">{isPost ? "Post Title:" : "Parent Post Title:"}</p>
              <p className="mb-3 text-card-foreground">{displayTitle}</p>
              
              <p className="font-bold text-base mb-1">{isPost ? "Post Content:" : "Comment Body:"}</p>
              <p className="max-h-60 overflow-y-auto text-muted-foreground">
                {displayContent}
              </p>
            </div>
          </PopoverContent>
        </Popover>
      );
    }
  },
  { key: 'author', header: 'Author', sortable: true, className: "w-[130px]" },
  { 
    key: 'score', 
    header: 'Score', 
    sortable: true, 
    render: (item) => <span className="text-right block">{item.score.toLocaleString()}</span>,
    className: "text-right w-[80px]"
  },
  { 
    key: 'numComments', 
    header: 'Replies', 
    sortable: true, 
    render: (item) => <span className="text-right block">{item.type === 'Post' ? item.numComments.toLocaleString() : '-'}</span>,
    className: "text-right w-[100px]"
  },
  { 
    key: 'sentiment', 
    header: 'Sentiment', 
    render: (item) => {
      let badgeVariant: "default" | "destructive" | "secondary" | "outline" = "outline";
      let text = "Unknown";
      switch (item.sentiment) {
        case 'positive':
          badgeVariant = "default"; 
          text = "Positive";
          break;
        case 'negative':
          badgeVariant = "destructive";
          text = "Negative";
          break;
        case 'neutral':
          badgeVariant = "secondary";
          text = "Neutral";
          break;
        default: 
          badgeVariant = "outline";
          text = "N/A";
          break;
      }
      return <Badge variant={badgeVariant}>{text}</Badge>;
    },
    className: "w-[100px]"
  },
  { 
    key: 'link', 
    header: 'Link',
    render: (item) => (
      <Button variant="ghost" size="icon" asChild className="h-8 w-8">
        <a href={item.url} target="_blank" rel="noopener noreferrer" title={`Open ${item.type} on Reddit`}>
          <ExternalLink className="h-4 w-4 text-primary" />
        </a>
      </Button>
    ),
    className: "text-center w-[60px]"
  },
];


export default function RedditPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(''); 
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [isSavingKeywords, setIsSavingKeywords] = useState<boolean>(false);
  
  const editKeywordsForm = useForm<EditKeywordsFormValues>({
    resolver: zodResolver(editKeywordsSchema),
    defaultValues: { keywords: "" },
  });

  // User view state
  const [redditPosts, setRedditPosts] = useState<RedditPost[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(false);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [lastLoadedDocId, setLastLoadedDocId] = useState<string | null>(null);
  const [hasMoreToLoad, setHasMoreToLoad] = useState<boolean>(true);
  const ITEMS_PER_PAGE = 20; // Number of items to load per page from Firestore

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      setIsLoadingUsers(true);
      getUsers()
        .then(setAllUsers)
        .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to fetch user list." }))
        .finally(() => setIsLoadingUsers(false));
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (currentUser?.role === 'admin' && selectedUserId) {
      const userToEdit = allUsers.find(u => u.id === selectedUserId);
      if (userToEdit) {
        editKeywordsForm.reset({ keywords: userToEdit.assignedKeywords?.join(', ') || "" });
      }
    } else if (currentUser?.role === 'admin' && !selectedUserId) {
      editKeywordsForm.reset({ keywords: ""}); 
    }
  }, [selectedUserId, allUsers, currentUser, editKeywordsForm]);

  const onEditKeywordsSubmit = async (data: EditKeywordsFormValues) => {
    if (!selectedUserId || currentUser?.role !== 'admin') return;
    const userToEdit = allUsers.find(u => u.id === selectedUserId);
    if (!userToEdit) {
        toast({ variant: "destructive", title: "Error", description: "Selected user not found." });
        return;
    }

    setIsSavingKeywords(true);
    const keywordsArray = data.keywords ? data.keywords.split(',').map(k => k.trim()).filter(k => k !== "") : [];
    try {
      const result = await updateUserKeywords(selectedUserId, keywordsArray);
      if (result.success) {
        toast({ title: "Keywords Updated", description: `Keywords for ${userToEdit.name} saved.` });
        setAllUsers(prevUsers => prevUsers.map(u => u.id === selectedUserId ? {...u, assignedKeywords: keywordsArray} : u));
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.error || "Could not update keywords." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsSavingKeywords(false);
    }
  };

  const loadStoredFeed = useCallback(async (loadMore = false) => {
    if (!currentUser || currentUser.role !== 'user' || authLoading) return;

    if (loadMore) setIsLoadingMore(true);
    else setIsLoadingFeed(true);

    try {
      const { data, lastDocId: newLastDocId } = await getStoredRedditFeedForUser(currentUser.id, {
        limitNum: ITEMS_PER_PAGE,
        startAfterDocId: loadMore ? lastLoadedDocId : null,
      });

      if (data) {
        setRedditPosts(prev => loadMore ? [...prev, ...data] : data);
        setLastLoadedDocId(newLastDocId);
        setHasMoreToLoad(data.length === ITEMS_PER_PAGE && !!newLastDocId);

        if (!loadMore && data.length === 0) {
          toast({
            title: "Feed Empty or Not Yet Synced",
            description: "Your Reddit feed is currently empty. Try refreshing or check back after initial sync.",
            duration: 5000,
          });
        }
      } else {
        setHasMoreToLoad(false);
         if (!loadMore) setRedditPosts([]); // Clear posts if initial load fails or returns null
      }
    } catch (error) {
      console.error("Error loading stored Reddit feed:", error);
      toast({ variant: "destructive", title: "Feed Load Error", description: "Could not load your Reddit feed from storage." });
      if (!loadMore) setRedditPosts([]);
      setHasMoreToLoad(false);
    } finally {
      if (loadMore) setIsLoadingMore(false);
      else setIsLoadingFeed(false);
    }
  }, [currentUser, authLoading, toast, lastLoadedDocId]);

  useEffect(() => {
    if (currentUser?.role === 'user' && !authLoading) {
      if (currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0) {
        loadStoredFeed();
      } else {
        setIsLoadingFeed(false);
        setRedditPosts([]);
        setHasMoreToLoad(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, authLoading]); 

  const handleRefreshFeed = async () => {
    if (!currentUser || currentUser.role !== 'user' || !currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0) {
      toast({
        variant: "destructive",
        title: "Cannot Refresh",
        description: "No keywords assigned. Please contact an administrator.",
      });
      return;
    }
    setIsRefreshingFeed(true);
    setRedditPosts([]); // Clear current posts
    setLastLoadedDocId(null); // Reset pagination
    setHasMoreToLoad(true); // Assume there might be data

    try {
      toast({
        title: "Refreshing Feed...",
        description: "Fetching latest data from Reddit and analyzing sentiments. This may take a moment.",
      });
      const result = await fetchAndStoreRedditDataForUser(currentUser.id, currentUser.assignedKeywords);
      if (result.success) {
        toast({
          title: "Feed Refreshed",
          description: `${result.count} items fetched and stored. Displaying updated feed.`,
        });
        await loadStoredFeed(); // Load the newly stored data
      } else {
        toast({
          variant: "destructive",
          title: "Refresh Failed",
          description: result.error || "Could not refresh feed from Reddit.",
        });
        await loadStoredFeed(); // Try to load existing stored data even if refresh failed
      }
    } catch (error) {
      console.error("Error refreshing Reddit feed:", error);
      toast({ variant: "destructive", title: "Refresh Error", description: "An unexpected error occurred." });
      await loadStoredFeed(); // Try to load existing stored data on error
    } finally {
      setIsRefreshingFeed(false);
    }
  };


  if (authLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) { 
    router.replace('/login');
    return null;
  }

  if (currentUser.role === 'admin') {
    const selectedUserDetails = allUsers.find(u => u.id === selectedUserId);
    const descriptionText = "Select a user to view and edit their assigned keywords. These keywords are used for their personalized Reddit feed, which is fetched and stored in the database.";

    return (
      <DataTableShell
        title="Manage User Keywords for Reddit"
        description={descriptionText}
      >
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Label htmlFor="user-select" className="text-sm font-medium shrink-0">Select User:</Label>
            {isLoadingUsers ? (
                <div className="flex items-center text-sm text-muted-foreground w-full sm:w-[300px]">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users...
                </div>
            ) : (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="user-select" className="w-full sm:w-[300px] bg-background shadow-sm">
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            )}
          </div>

          {selectedUserId && selectedUserDetails && (
            <Form {...editKeywordsForm}>
              <form onSubmit={editKeywordsForm.handleSubmit(onEditKeywordsSubmit)} className="space-y-4 p-4 border rounded-md shadow-sm bg-card">
                <h3 className="text-lg font-semibold">
                  Editing Keywords for: <span className="text-primary">{selectedUserDetails.name}</span>
                </h3>
                <FormField
                  control={editKeywordsForm.control}
                  name="keywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Keywords (comma-separated)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., technology, AI, startups"
                          rows={4}
                          {...field}
                          disabled={isSavingKeywords}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSavingKeywords || !editKeywordsForm.formState.isDirty}>
                  {isSavingKeywords ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Keywords for {selectedUserDetails.name.split(' ')[0]}
                </Button>
              </form>
            </Form>
          )}
           {!selectedUserId && !isLoadingUsers && (
            <div className="text-center py-10 text-muted-foreground">
                <UsersIcon className="mx-auto h-12 w-12 mb-3" />
                <p>Please select a user from the dropdown to manage their keywords.</p>
            </div>
           )}
        </div>
      </DataTableShell>
    );
  }

  if (currentUser.role === 'user') {
    let userPageDescription = "Your Reddit feed, powered by stored data. Click 'Refresh Feed' to fetch the latest from Reddit. Data is filtered from June 1, 2025.";
    if (!currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0) {
      userPageDescription = "You have no assigned keywords for your Reddit feed. Please contact an administrator.";
    } else if (isLoadingFeed) {
      userPageDescription = `Loading your stored Reddit feed for keywords: "${currentUser.assignedKeywords.join(', ')}"...`;
    } else if (isRefreshingFeed) {
      userPageDescription = `Refreshing feed for keywords: "${currentUser.assignedKeywords.join(', ')}" from Reddit...`;
    } else {
      userPageDescription = `Showing stored Reddit posts and comments for your keywords: "${currentUser.assignedKeywords.join(', ')}". ${redditPosts.length} items shown.`;
    }


    return (
      <DataTableShell
        title="Your Reddit Keyword Feed"
        description={userPageDescription}
      >
        <div className="mb-4 flex justify-end">
            <Button onClick={handleRefreshFeed} disabled={isRefreshingFeed || isLoadingFeed || !currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0}>
                {isRefreshingFeed ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh Feed & Analyze Sentiments
            </Button>
        </div>

        {(isLoadingFeed && !isRefreshingFeed) && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Loading your stored Reddit feed...</p>
          </div>
        )}

        {!isLoadingFeed && !isRefreshingFeed && (!currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0) && (
          <div className="text-center py-10">
            <Rss className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-semibold">No Keywords Assigned</p>
            <p className="text-muted-foreground">
              Your Reddit feed cannot be displayed as you have no keywords assigned.
              <br />
              Please contact an administrator to assign keywords to your profile.
            </p>
          </div>
        )}
        
        {!isLoadingFeed && !isRefreshingFeed && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0 && redditPosts.length === 0 && (
          <div className="text-center py-10">
            <Rss className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-semibold">No Reddit Posts or Comments Found</p>
            <p className="text-muted-foreground">
              No items found in your stored feed for keywords: "{currentUser.assignedKeywords.join(', ')}".
              <br/>
              Try clicking "Refresh Feed" to fetch the latest from Reddit.
            </p>
          </div>
        )}

        {(!isLoadingFeed || isRefreshingFeed) && redditPosts.length > 0 && (
          <>
            <GenericDataTable<RedditPost>
              data={redditPosts}
              columns={redditPostColumnsUserView} 
              caption={`Displaying ${redditPosts.length} stored Reddit items. Click "Refresh Feed" for latest.`}
            />
            {hasMoreToLoad && !isRefreshingFeed && (
              <div className="mt-6 flex justify-center">
                <Button 
                  onClick={() => loadStoredFeed(true)} 
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                  Load More Stored Items
                </Button>
              </div>
            )}
             {!hasMoreToLoad && !isLoadingFeed && !isRefreshingFeed && redditPosts.length > 0 && (
                <p className="text-center text-sm text-muted-foreground mt-6">End of stored feed.</p>
            )}
          </>
        )}
      </DataTableShell>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <p className="text-muted-foreground">Page content not available for your role.</p>
    </div>
  );
}

    