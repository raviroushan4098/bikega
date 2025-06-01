
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import type { ColumnConfig, RedditPost, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Rss, Users as UsersIcon, Edit3, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getUsers, updateUserKeywords } from '@/lib/user-service';
import { searchReddit } from '@/lib/reddit-api-service'; // Needed for user view
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

// Schema for admin's keyword editing form
const editKeywordsSchema = z.object({
  keywords: z.string().optional(),
});
type EditKeywordsFormValues = z.infer<typeof editKeywordsSchema>;

// Columns for Reddit posts (for user view)
const redditPostColumns: ColumnConfig<RedditPost>[] = [
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

export default function RedditPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // --- Admin View State ---
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [isSavingKeywords, setIsSavingKeywords] = useState<boolean>(false);
  
  const editKeywordsForm = useForm<EditKeywordsFormValues>({
    resolver: zodResolver(editKeywordsSchema),
    defaultValues: { keywords: "" },
  });

  // --- User View State ---
  const [redditPosts, setRedditPosts] = useState<RedditPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(false);
  const [displayedSearchTerm, setDisplayedSearchTerm] = useState<string | null>(null);

  // Fetch all users for admin dropdown
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      setIsLoadingUsers(true);
      getUsers()
        .then(setAllUsers)
        .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to fetch user list." }))
        .finally(() => setIsLoadingUsers(false));
    }
  }, [currentUser, toast]);

  // Effect to update form when admin selects a different user
  useEffect(() => {
    if (currentUser?.role === 'admin' && selectedUserId) {
      const userToEdit = allUsers.find(u => u.id === selectedUserId);
      if (userToEdit) {
        editKeywordsForm.reset({ keywords: userToEdit.assignedKeywords?.join(', ') || "" });
      }
    } else if (currentUser?.role === 'admin' && !selectedUserId) {
      editKeywordsForm.reset({ keywords: ""}); // Clear form if no user is selected
    }
  }, [selectedUserId, allUsers, currentUser, editKeywordsForm]);

  // Handler for admin saving keywords
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
        // Update the local 'allUsers' state to reflect changes immediately
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

  // Handler for fetching Reddit posts (for user view)
  const fetchRedditPostsForUser = useCallback(async (keywords: string[]) => {
    if (keywords.length === 0) {
      setRedditPosts([]);
      setDisplayedSearchTerm(null);
      setIsLoadingPosts(false);
      return;
    }
    const query = keywords.join(' OR ');
    setIsLoadingPosts(true);
    setDisplayedSearchTerm(query);
    try {
      const { data, error } = await searchReddit({ q: query, limit: 25, sort: 'relevance' });
      if (error) {
        toast({ variant: "destructive", title: "Reddit Search Failed", description: error });
        setRedditPosts([]);
      } else if (data) {
        setRedditPosts(data);
        if (data.length === 0) {
          toast({ title: "No Results", description: `No Reddit posts found for your keywords: "${query}".` });
        }
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred during Reddit search." });
      setRedditPosts([]);
    } finally {
      setIsLoadingPosts(false);
    }
  }, [toast]);

  // Effect for user view: fetch posts based on their keywords
  useEffect(() => {
    if (!authLoading && currentUser?.role === 'user') {
      if (currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0) {
        fetchRedditPostsForUser(currentUser.assignedKeywords);
      } else {
        setIsLoadingPosts(false);
        setRedditPosts([]);
        setDisplayedSearchTerm(null);
      }
    }
  }, [currentUser, authLoading, fetchRedditPostsForUser]);


  if (authLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) { // Should be caught by layout, but as a safeguard
    router.replace('/login');
    return null;
  }

  // Admin View: Manage User Keywords
  if (currentUser.role === 'admin') {
    const selectedUserDetails = allUsers.find(u => u.id === selectedUserId);
    return (
      <DataTableShell
        title="Manage User Keywords for Reddit"
        description="Select a user to view and edit their assigned keywords. These keywords may be used for features like personalized Reddit feeds for users."
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
                <SelectItem value="">Select a user...</SelectItem>
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

  // User View: Display Reddit Posts based on their assigned keywords
  if (currentUser.role === 'user') {
    let userPageDescription = "Your Reddit feed based on assigned keywords.";
    if (!currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0) {
      userPageDescription = "You have no assigned keywords for your Reddit feed. Please contact an administrator.";
    } else if (displayedSearchTerm) {
      userPageDescription = `Showing posts related to your keywords: "${displayedSearchTerm}".`;
    }

    return (
      <DataTableShell
        title="Your Reddit Keyword Feed"
        description={userPageDescription}
      >
        {isLoadingPosts && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Fetching Reddit posts for your keywords...</p>
          </div>
        )}

        {!isLoadingPosts && (!currentUser.assignedKeywords || currentUser.assignedKeywords.length === 0) && (
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
        
        {!isLoadingPosts && currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0 && redditPosts.length === 0 && displayedSearchTerm && (
          <div className="text-center py-10">
            <Rss className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-semibold">No Reddit Posts Found</p>
            <p className="text-muted-foreground">
              No posts matched your assigned keywords: "{displayedSearchTerm}".
            </p>
          </div>
        )}

        {!isLoadingPosts && redditPosts.length > 0 && (
          <GenericDataTable<RedditPost>
            data={redditPosts}
            columns={redditPostColumns}
            caption={displayedSearchTerm ? `Showing Reddit posts related to your keywords: "${displayedSearchTerm}"` : "Your Reddit Posts"}
          />
        )}
      </DataTableShell>
    );
  }

  // Fallback for unexpected scenarios (e.g., if role is neither admin nor user)
  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <p className="text-muted-foreground">Page content not available for your role.</p>
    </div>
  );
}
