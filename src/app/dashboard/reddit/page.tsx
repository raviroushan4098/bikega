
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import type { ColumnConfig, RedditPost, User, RedditSearchParams } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Rss, Users as UsersIcon, Save, ExternalLink, PopoverClose } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getUsers, updateUserKeywords } from '@/lib/user-service';
import { searchReddit } from '@/lib/reddit-api-service'; // Changed back
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
  // Removed Firestore cache related states

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

  const fetchUserRedditFeed = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'user' || authLoading || !currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0) {
      setRedditPosts([]);
      setIsLoadingFeed(false);
      return;
    }

    setIsLoadingFeed(true);
    try {
      const query = currentUser.assignedKeywords.join(' OR ');
      const searchParams: RedditSearchParams = { q: query, limit: 50, sort: 'new' }; // Example: fetch 50 items
      const { data, error } = await searchReddit(searchParams);

      if (error) {
        toast({ variant: "destructive", title: "Reddit Feed Error", description: error });
        setRedditPosts([]);
      } else if (data) {
        setRedditPosts(data);
        if (data.length === 0) {
           toast({
            title: "No Reddit Content Found",
            description: `No posts or comments found for your keywords: "${currentUser.assignedKeywords.join('", "')}". Data is filtered from June 1, 2025.`,
            duration: 7000,
          });
        }
      } else {
        setRedditPosts([]);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Reddit Feed Error", description: "An unexpected error occurred while fetching your feed." });
      setRedditPosts([]);
    } finally {
      setIsLoadingFeed(false);
    }
  }, [currentUser, authLoading, toast]);

  useEffect(() => {
    if (currentUser?.role === 'user' && !authLoading) {
      fetchUserRedditFeed();
    }
  }, [currentUser, authLoading, fetchUserRedditFeed]);


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
    const descriptionText = "Select a user to view and edit their assigned keywords. These keywords are used for their personalized Reddit feed, fetched directly from Reddit API (not stored).";

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
    let userPageDescription = "Your live Reddit feed based on your keywords. Data is fetched from Reddit and filtered from June 1, 2025.";
    if (!currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0) {
      userPageDescription = "You have no assigned keywords for your Reddit feed. Please contact an administrator.";
    } else if (isLoadingFeed) {
      userPageDescription = `Loading your Reddit feed for keywords: "${currentUser.assignedKeywords.join(', ')}"...`;
    } else {
      userPageDescription = `Showing Reddit posts and comments for your keywords: "${currentUser.assignedKeywords.join(', ')}". ${redditPosts.length} items shown.`;
    }

    return (
      <DataTableShell
        title="Your Reddit Keyword Feed"
        description={userPageDescription}
      >
        {isLoadingFeed && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Loading your Reddit feed...</p>
          </div>
        )}

        {!isLoadingFeed && (!currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0) && (
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
        
        {!isLoadingFeed && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0 && redditPosts.length === 0 && (
          <div className="text-center py-10">
            <Rss className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-semibold">No Reddit Posts or Comments Found</p>
            <p className="text-muted-foreground">
              No items found from Reddit for keywords: "{currentUser.assignedKeywords.join(', ')}" (filtered from June 1, 2025).
            </p>
          </div>
        )}

        {!isLoadingFeed && redditPosts.length > 0 && (
          <GenericDataTable<RedditPost>
            data={redditPosts}
            columns={redditPostColumnsUserView} 
            caption={`Displaying ${redditPosts.length} live Reddit items for your keywords.`}
          />
        )}
        {/* Removed Load More button as direct API fetching usually gets a fixed batch per call without simple client-side pagination */}
      </DataTableShell>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <p className="text-muted-foreground">Page content not available for your role.</p>
    </div>
  );
}
