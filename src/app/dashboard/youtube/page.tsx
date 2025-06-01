
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable, renderImageCell } from '@/components/analytics/generic-data-table';
import { useAuth } from '@/contexts/auth-context';
import type { ColumnConfig, YoutubeVideo, User } from '@/types';
import { getUsers } from '@/lib/user-service';
import { addYoutubeVideoToFirestore, getYoutubeVideosFromFirestore } from '@/lib/youtube-video-service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';

const addVideoSchema = z.object({
  url: z.string().url({ message: "Please enter a valid YouTube URL." }),
  assignedToUserId: z.string().min(1, { message: "Please select a user." }), // This ID is crucial
});
type AddVideoFormValues = z.infer<typeof addVideoSchema>;

export default function YouTubeAnalyticsPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [selectedUserIdForFilter, setSelectedUserIdForFilter] = useState<string>(''); 

  const [isAddVideoDialogOpen, setIsAddVideoDialogOpen] = useState(false);
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);

  const form = useForm<AddVideoFormValues>({
    resolver: zodResolver(addVideoSchema),
    defaultValues: {
      url: "",
      assignedToUserId: "", 
    },
  });

  useEffect(() => {
    console.log("[YouTubePage] State Update Triggered. Current State:", {
      currentUserEmail: currentUser?.email,
      currentUserRole: currentUser?.role,
      selectedUserIdForFilter,
      allUsersCount: allUsers.length,
      videosCount: videos.length,
      isLoadingVideos,
      isLoadingUsers,
    });
  }, [currentUser, selectedUserIdForFilter, allUsers, videos, isLoadingVideos, isLoadingUsers]);

  useEffect(() => {
    console.log("[YouTubePage] allUsers state updated for dropdown:", allUsers.map(u => ({id: u.id, name: u.name})));
  }, [allUsers]);

  const columns: ColumnConfig<YoutubeVideo>[] = useMemo(() => [
    {
      key: 'thumbnailUrl',
      header: 'Thumbnail',
      render: (item) => renderImageCell(item, 'thumbnail'),
      className: "w-[100px]"
    },
    { key: 'title', header: 'Title', sortable: true, className: "min-w-[200px] font-medium" },
    { key: 'channelTitle', header: 'Channel', sortable: true, className: "min-w-[120px]" },
    {
      key: 'assignedToUserId',
      header: 'Assigned To',
      render: (item: YoutubeVideo) => {
        if (!item.assignedToUserId) return <Badge variant="outline">Error: No User ID</Badge>;
        const user = allUsers.find(u => u.id === item.assignedToUserId);
        if (!user) {
            console.warn(`[YouTubePage] User not found in 'allUsers' for assignedToUserId: '${item.assignedToUserId}' on video ID '${item.id}'. 'allUsers' contains IDs: ${allUsers.map(u=>u.id).join(', ')}`);
            return <Badge variant="destructive" className="text-xs">User ID: {item.assignedToUserId} (Not Found)</Badge>;
        }
        return <Badge variant="secondary">{user.name}</Badge>;
      },
      className: "min-w-[150px]"
    },
    {
      key: 'likeCount',
      header: 'Likes',
      sortable: true,
      render: (item) => item.likeCount?.toLocaleString() ?? '0',
      className: "text-right w-[100px]"
    },
    {
      key: 'commentCount',
      header: 'Comments',
      sortable: true,
      render: (item) => item.commentCount?.toLocaleString() ?? '0',
      className: "text-right w-[120px]"
    },
    {
      key: 'shareCount',
      header: 'Shares',
      sortable: true,
      render: (item) => item.shareCount?.toLocaleString() ?? '0',
      className: "text-right w-[100px]"
    },
    {
      key: 'createdAt',
      header: 'Date Added',
      sortable: true,
      render: (item) => item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A",
      className: "w-[120px]"
    }
  ], [allUsers]);


  const fetchVideos = useCallback(async () => {
    if (!currentUser) {
      console.log("[YouTubePage] currentUser not available, skipping fetchVideos.");
      setIsLoadingVideos(false);
      setVideos([]); 
      return;
    }

    let filterIdForService: string | undefined = undefined;
    if (currentUser.role === 'admin') {
      if (selectedUserIdForFilter && selectedUserIdForFilter !== 'all' && selectedUserIdForFilter !== '') {
        filterIdForService = selectedUserIdForFilter;
      } else {
        console.log("[YouTubePage] Admin view: No specific user selected for filter. Clearing videos.");
        setVideos([]); 
        setIsLoadingVideos(false);
        return;
      }
    } else if (currentUser.role === 'user') {
      filterIdForService = currentUser.id;
    }

    if (!filterIdForService) {
        console.log("[YouTubePage] fetchVideos: No valid filterIdForService determined. Skipping fetch.");
        setVideos([]);
        setIsLoadingVideos(false);
        return;
    }
    
    setIsLoadingVideos(true);
    console.log(`[YouTubePage] fetchVideos called. Role: ${currentUser.role}, SelectedFilter (dropdown state): '${selectedUserIdForFilter}', Actual filterIdForService for query: '${filterIdForService}'`);
    
    try {
      const fetchedVideos = await getYoutubeVideosFromFirestore(filterIdForService);
      console.log(`[YouTubePage] Fetched ${fetchedVideos.length} videos from Firestore using filterIdForService '${filterIdForService}'.`);
      if (fetchedVideos.length > 0) {
        console.log(`[YouTubePage] Sample of first video fetched for '${filterIdForService}':`, {id: fetchedVideos[0].id, title: fetchedVideos[0].title, assignedTo: fetchedVideos[0].assignedToUserId});
      }
      setVideos(fetchedVideos);
    } catch (error) {
      console.error("[YouTubePage] Error in fetchVideos:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch videos from Firestore." });
      setVideos([]);
    } finally {
      setIsLoadingVideos(false);
    }
  }, [currentUser, selectedUserIdForFilter, toast]);

  useEffect(() => {
    if (currentUser) {
        if (currentUser.role === 'user') { // User: always fetch their videos
            fetchVideos();
        } else if (currentUser.role === 'admin' && selectedUserIdForFilter && selectedUserIdForFilter !== 'all' && selectedUserIdForFilter !== '') { // Admin: fetch if a specific user is selected
            fetchVideos();
        } else if (currentUser.role === 'admin' && (!selectedUserIdForFilter || selectedUserIdForFilter === 'all' || selectedUserIdForFilter === '')) {
            setVideos([]);
            setIsLoadingVideos(false); 
            console.log("[YouTubePage] Admin view: No specific user selected for filter. Videos cleared. Select a user to view their assignments.");
        }
    } else {
        console.log("[YouTubePage] currentUser not available, skipping fetchVideos in effect.");
        setVideos([]);
        setIsLoadingVideos(false);
    }
  }, [fetchVideos, currentUser, selectedUserIdForFilter]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      setIsLoadingUsers(true);
      getUsers()
        .then(users => {
          setAllUsers(users);
          console.log("[YouTubePage] Fetched users for admin dropdown:", users.map(u => ({id: u.id, name: u.name, email: u.email})));
        })
        .catch(error => {
          console.error("[YouTubePage] Failed to fetch users for admin dropdown:", error);
          toast({ variant: "destructive", title: "Error", description: "Failed to fetch users list." });
        })
        .finally(() => setIsLoadingUsers(false));
    } else if (currentUser?.role === 'user' && currentUser.id && currentUser.name) {
      setAllUsers([{ ...currentUser }]); 
    }
  }, [currentUser, toast]);

  async function onSubmitAddVideo(data: AddVideoFormValues) {
    setIsSubmittingVideo(true);
    console.log("[YouTubePage] onSubmitAddVideo: Attempting to assign video to user ID:", data.assignedToUserId, "Video URL:", data.url);
    if (!data.assignedToUserId) {
        toast({ variant: "destructive", title: "Error", description: "User ID for assignment is missing." });
        setIsSubmittingVideo(false);
        return;
    }
    try {
      await addYoutubeVideoToFirestore(data.url, data.assignedToUserId);
      toast({
        title: "Video Assigned",
        description: `Video from ${data.url} has been assigned and saved to Firestore.`,
      });
      form.reset();
      setIsAddVideoDialogOpen(false);

      // Refresh videos if the current view matches the user to whom the video was assigned
      if (currentUser?.role === 'admin' && selectedUserIdForFilter === data.assignedToUserId) {
        fetchVideos();
      } else if (currentUser?.role === 'user' && currentUser.id === data.assignedToUserId) {
        fetchVideos();
      }
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Assigning Video",
        description: (error as Error).message || "Could not assign the video. Please try again.",
      });
      console.error("[YouTubePage] Error assigning video:", error);
    } finally {
      setIsSubmittingVideo(false);
    }
  }

  const displayedVideos = useMemo(() => {
    console.log("[YouTubePage] displayedVideos (data passed to table):", videos.map(v => ({id: v.id, title: v.title, assignedToUserId: v.assignedToUserId })));
    return videos;
  }, [videos]);


  if (!currentUser && (isLoadingUsers || isLoadingVideos)) { 
     return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (currentUser?.role === 'admin' && isLoadingUsers && allUsers.length === 0 && !isAddVideoDialogOpen) {
     return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <p className="text-muted-foreground mr-2">Loading user list for admin...</p>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <DataTableShell
      title="YouTube Analytics (Firestore)"
      description={
        currentUser?.role === 'admin' 
        ? "Assign videos to users. Select a user from the dropdown to view their specific video list."
        : "Track performance of YouTube videos assigned to you."
      }
    >
      {currentUser?.role === 'admin' && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="user-select-filter" className="text-sm font-medium shrink-0">View videos for:</Label>
            {isLoadingUsers && allUsers.length === 0 ? (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users...
              </div>
            ) : (
              <Select
                value={selectedUserIdForFilter}
                onValueChange={(value) => {
                    console.log("[YouTubePage] Admin selected user from filter dropdown. New selectedUserIdForFilter:", value);
                    setSelectedUserIdForFilter(value === 'all' ? '' : value); // Treat 'all' as empty selection
                    if (value === 'all' || value === '') { 
                        setVideos([]);
                    }
                }}
              >
                <SelectTrigger id="user-select-filter" className="w-full sm:w-[320px] bg-background shadow-sm">
                  <SelectValue placeholder="Select a user to view their assigned videos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">-- Select a User --</SelectItem> 
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Dialog open={isAddVideoDialogOpen} onOpenChange={setIsAddVideoDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto" disabled={isLoadingUsers && allUsers.length === 0}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add/Assign Video
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Add & Assign New YouTube Video</DialogTitle>
                <DialogDescription>
                  Enter video URL and assign to a user. Data saved to Firestore under user's specific video list.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitAddVideo)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>YouTube Video URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://www.youtube.com/watch?v=..." {...field} disabled={isSubmittingVideo} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="assignedToUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign to User</FormLabel>
                        <Select 
                            onValueChange={field.onChange} 
                            value={field.value} 
                            defaultValue={field.value} 
                            disabled={isSubmittingVideo || (isLoadingUsers && allUsers.length === 0)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue 
                                placeholder={
                                  isLoadingUsers && allUsers.length === 0 
                                  ? "Loading users..." 
                                  : allUsers.length === 0 
                                    ? "No users available"
                                    : "Select a user to assign"
                                } 
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(isLoadingUsers && allUsers.length === 0) && <SelectItem value="loading" disabled>Loading users...</SelectItem>}
                            {(!isLoadingUsers && allUsers.length === 0) && <SelectItem value="no-users" disabled>No users available to assign</SelectItem>}
                            {allUsers.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name} ({u.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddVideoDialogOpen(false)} disabled={isSubmittingVideo}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={
                        isSubmittingVideo || 
                        ((isLoadingUsers && allUsers.length === 0) && !form.getValues("assignedToUserId")) || 
                        !form.formState.isValid
                      }
                    >
                      {isSubmittingVideo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save Video Assignment
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      )}
       {isLoadingVideos && <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
      {!isLoadingVideos && (
        <GenericDataTable<YoutubeVideo>
          data={displayedVideos}
          columns={columns}
          caption={
            currentUser?.role === 'admin' && (!selectedUserIdForFilter || selectedUserIdForFilter === 'all' || selectedUserIdForFilter === '') 
            ? "Please select a user from the dropdown to view their assigned videos."
            : (currentUser?.role === 'user' && videos.length === 0)
              ? "No YouTube videos have been assigned to you yet."
              : (currentUser?.role === 'admin' && selectedUserIdForFilter && videos.length === 0)
                ? `No YouTube videos found assigned to the selected user.`
                : "YouTube Video Performance Data (from Firestore)"
          }
        />
      )}
    </DataTableShell>
  );
}

