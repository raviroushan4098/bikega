
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable, renderImageCell } from '@/components/analytics/generic-data-table';
import { useAuth } from '@/contexts/auth-context';
import type { ColumnConfig, YoutubeVideo, User as AuthUserType } from '@/types';
import { getUsers, assignYoutubeUrlToUser, removeYoutubeUrlFromUser, getUserById } from '@/lib/user-service';
import { fetchVideoDetailsFromYouTubeAPI, fetchBatchVideoDetailsFromYouTubeAPI } from '@/lib/youtube-video-service';
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
  DialogTrigger, // Added DialogTrigger
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircle, Loader2, Rss, Trash2, ExternalLink } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';

const addVideoSchema = z.object({
  url: z.string().url({ message: "Please enter a valid YouTube URL." }),
  assignedToUserId: z.string().min(1, { message: "Please select a user." }),
});
type AddVideoFormValues = z.infer<typeof addVideoSchema>;

export default function YouTubeAnalyticsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [displayedVideos, setDisplayedVideos] = useState<YoutubeVideo[]>([]);
  const [isLoadingPageData, setIsLoadingPageData] = useState<boolean>(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false); 
  const [allUsersForAdmin, setAllUsersForAdmin] = useState<AuthUserType[]>([]); 
  
  const [selectedUserIdForFilter, setSelectedUserIdForFilter] = useState<string>('');

  const [isAddVideoDialogOpen, setIsAddVideoDialogOpen] = useState(false);
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);

  useEffect(() => {
    console.log("[YouTubePage] State Update Triggered. Current State: ", {
      authLoading,
      currentUserEmail: currentUser?.email,
      currentUserRole: currentUser?.role,
      selectedUserIdForFilter,
      allUsersCount: allUsersForAdmin.length,
      videosCount: displayedVideos.length,
      isLoadingPageData,
      isLoadingUsers,
      isAddVideoDialogOpen,
      isSubmittingVideo,
    });
  }, [currentUser, selectedUserIdForFilter, displayedVideos, isLoadingPageData, isLoadingUsers, isAddVideoDialogOpen, isSubmittingVideo, authLoading, allUsersForAdmin]);


  const addVideoForm = useForm<AddVideoFormValues>({
    resolver: zodResolver(addVideoSchema),
    defaultValues: { url: "", assignedToUserId: "" },
  });
  
  const processAndFetchVideoDetails = useCallback(async (
    urls: string[],
    assignmentMap: Record<string, { userId: string, userName?: string }>
  ): Promise<YoutubeVideo[]> => {
    if (!urls || urls.length === 0) return [];
    // Here, urls are already assumed to be YouTube video URLs.
    // We need to extract video IDs for batch fetching.
    // For simplicity, we'll just use the URLs if ID extraction is problematic,
    // as fetchBatchVideoDetailsFromYouTubeAPI can handle URLs or IDs.
    // A more robust solution would ensure all are IDs before batching.

    // For now, assuming fetchBatchVideoDetails... can handle a mix or primarily IDs
    // The assignmentMap should already be keyed by video ID if possible, or URL if that's what's stored
    // This part needs to align with how video IDs are obtained from user.assignedYoutubeUrls
    // If assignedYoutubeUrls stores full URLs, ID extraction happens before this.
    
    // Let's assume for now that `fetchBatchVideoDetailsFromYouTubeAPI` expects video IDs.
    // And that `assignmentMap` is keyed by those video IDs.
    // So, `urls` here should ideally be an array of video IDs.
    // This implies logic upstream ensures this or `fetchBatch` is more flexible.
    // Based on current `fetchBatch` in `youtube-video-service`, it expects IDs.
    
    // This function is now more about passing IDs and the map to the service.
    // The previous `processUrlsToVideos` was for single fetches. This one is for batch.
    
    const videoDetails = await fetchBatchVideoDetailsFromYouTubeAPI(urls, assignmentMap);
    return videoDetails;

  }, []);


  const fetchAndSetVideos = useCallback(async () => {
    if (authLoading || !currentUser) {
      setDisplayedVideos([]); 
      setIsLoadingPageData(false);
      return;
    }

    console.log(`[YouTubePage] fetchVideos called. Role: ${currentUser.role}, Filter: ${selectedUserIdForFilter}, Users Loading: ${isLoadingUsers}`);
    setIsLoadingPageData(true);
    let fetchedVideos: YoutubeVideo[] = [];
    
    try {
      if (currentUser.role === 'admin') {
        if (selectedUserIdForFilter === 'all') {
          if (isLoadingUsers && allUsersForAdmin.length === 0) {
            console.log("[YouTubePage] Admin 'all': Users still loading. Deferring.");
            // isLoadingPageData remains true, main loader spins.
            return; 
          }
          if (!isLoadingUsers && allUsersForAdmin.length === 0) {
            console.log("[YouTubePage] Admin 'all': No users. No videos to fetch.");
            setDisplayedVideos([]);
            setIsLoadingPageData(false);
            return;
          }
          
          console.log("[YouTubePage] Admin 'all': Fetching all users' videos.");
          const videoIdToAssignmentMap: Record<string, { userId: string, userName?: string }> = {};
          const allVideoIds: string[] = [];

          allUsersForAdmin.forEach(u => {
            u.assignedYoutubeUrls?.forEach(url => {
              const videoId = new URL(url).searchParams.get('v') || new URL(url).pathname.split('/').pop(); // Basic ID extraction
              if (videoId && !videoIdToAssignmentMap[videoId]) { // Avoid duplicate processing of same video ID if assigned to multiple
                videoIdToAssignmentMap[videoId] = { userId: u.id, userName: u.name };
                allVideoIds.push(videoId);
              } else if (videoId && videoIdToAssignmentMap[videoId] && videoIdToAssignmentMap[videoId].userId !== u.id) {
                // If already seen, but assigned to a different user (edge case, usually one video one primary assignment context)
                // For "show all", we just need one entry for the video. First encountered assignment wins for display context.
              }
            });
          });
          
          if (allVideoIds.length > 0) {
             fetchedVideos = await processAndFetchVideoDetails(allVideoIds, videoIdToAssignmentMap);
          } else {
            fetchedVideos = [];
          }
          console.log(`[YouTubePage] Admin 'all': Fetched ${fetchedVideos.length} videos.`);

        } else if (selectedUserIdForFilter) { // Specific user selected by admin
          console.log(`[YouTubePage] Admin specific user: '${selectedUserIdForFilter}'.`);
          const userDoc = allUsersForAdmin.find(u => u.id === selectedUserIdForFilter) || await getUserById(selectedUserIdForFilter);
          if (userDoc && userDoc.assignedYoutubeUrls && userDoc.assignedYoutubeUrls.length > 0) {
            const videoIdToAssignmentMap: Record<string, { userId: string, userName?: string }> = {};
            const videoIdsForUser: string[] = [];
            userDoc.assignedYoutubeUrls.forEach(url => {
                const videoId = new URL(url).searchParams.get('v') || new URL(url).pathname.split('/').pop();
                if (videoId) {
                    videoIdsForUser.push(videoId);
                    videoIdToAssignmentMap[videoId] = { userId: userDoc.id, userName: userDoc.name };
                }
            });
            fetchedVideos = await processAndFetchVideoDetails(videoIdsForUser, videoIdToAssignmentMap);
          } else {
            fetchedVideos = [];
          }
          console.log(`[YouTubePage] Admin specific user: Fetched ${fetchedVideos.length} videos for ${selectedUserIdForFilter}.`);
        } else { // Admin, but no user selected and not 'all' (initial state)
          fetchedVideos = []; 
          console.log("[YouTubePage] Admin: No specific user or 'all' selected yet.");
        }
      } else { // Regular user view
        console.log(`[YouTubePage] User view for ${currentUser.id}.`);
        if (currentUser.assignedYoutubeUrls && currentUser.assignedYoutubeUrls.length > 0) {
            const videoIdToAssignmentMap: Record<string, { userId: string, userName?: string }> = {};
            const videoIdsForUser: string[] = [];
            currentUser.assignedYoutubeUrls.forEach(url => {
                const videoId = new URL(url).searchParams.get('v') || new URL(url).pathname.split('/').pop();
                if (videoId) {
                    videoIdsForUser.push(videoId);
                    videoIdToAssignmentMap[videoId] = { userId: currentUser.id, userName: currentUser.name };
                }
            });
          fetchedVideos = await processAndFetchVideoDetails(videoIdsForUser, videoIdToAssignmentMap);
        } else {
          fetchedVideos = [];
        }
        console.log(`[YouTubePage] User view: Fetched ${fetchedVideos.length} videos.`);
      }
      setDisplayedVideos(fetchedVideos);
    } catch (error) {
      console.error("[YouTubePage] Error fetching or processing video data:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load YouTube video data." });
      setDisplayedVideos([]);
    } finally {
        setIsLoadingPageData(false); 
    }
  }, [currentUser, authLoading, selectedUserIdForFilter, processAndFetchVideoDetails, toast, allUsersForAdmin, isLoadingUsers]);

  useEffect(() => {
    fetchAndSetVideos();
  }, [fetchAndSetVideos]);

  useEffect(() => {
    if (currentUser?.role === 'admin' && !isLoadingUsers && allUsersForAdmin.length === 0) { 
      setIsLoadingUsers(true);
      getUsers()
        .then(users => {
          setAllUsersForAdmin(users);
          console.log(`[YouTubePage] Fetched ${users.length} users for admin dropdown.`);
        })
        .catch(error => {
          toast({ variant: "destructive", title: "Error", description: "Failed to fetch user list for admin." });
          setAllUsersForAdmin([]); 
        })
        .finally(() => {
            setIsLoadingUsers(false)
        });
    } else if (currentUser?.role === 'admin' && allUsersForAdmin.length > 0) {
        setIsLoadingUsers(false); // Ensure it's false if users are already loaded
    }
  }, [currentUser, toast, allUsersForAdmin.length, isLoadingUsers]); // Added isLoadingUsers

  async function onSubmitAddVideo(data: AddVideoFormValues) {
    setIsSubmittingVideo(true);
    try {
      // Basic URL validation / ID extraction before assigning
      const videoId = new URL(data.url).searchParams.get('v') || new URL(data.url).pathname.split('/').pop();
      if (!videoId) {
        toast({ variant: "destructive", title: "Invalid URL", description: "Could not extract video ID from URL." });
        setIsSubmittingVideo(false);
        return;
      }
      const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

      const result = await assignYoutubeUrlToUser(data.assignedToUserId, canonicalUrl);
      if (result.success) {
        toast({ title: "Video Assigned", description: `Video URL has been assigned to the user.` });
        addVideoForm.reset();
        setIsAddVideoDialogOpen(false);
        // Optimistically update local state or refetch
        setAllUsersForAdmin(prevUsers => prevUsers.map(u => 
            u.id === data.assignedToUserId 
            ? { ...u, assignedYoutubeUrls: [...(u.assignedYoutubeUrls || []), canonicalUrl].filter((v,i,a)=>a.indexOf(v)===i) } // ensure unique
            : u
        ));
        await fetchAndSetVideos(); 
      } else {
        toast({ variant: "destructive", title: "Assignment Failed", description: result.error || "Could not assign video URL." });
      }
    } catch (error) {
      let message = "An unexpected error occurred.";
      if (error instanceof Error && error.message.includes("Invalid URL")) {
          message = "The entered URL is not valid. Please provide a valid YouTube video URL.";
      } else if (error instanceof Error) {
          message = error.message;
      }
      toast({ variant: "destructive", title: "Error", description: message });
    } finally {
      setIsSubmittingVideo(false);
    }
  }
  
  const handleRemoveVideo = async (videoToRemove: YoutubeVideo) => {
     if (!confirm(`Are you sure you want to remove the video "${videoToRemove.title || videoToRemove.url}" for user ${videoToRemove.assignedToUserName || videoToRemove.assignedToUserId}?`)) {
      return;
    }
    try {
      const result = await removeYoutubeUrlFromUser(videoToRemove.assignedToUserId, videoToRemove.url);
      if (result.success) {
        toast({ title: "Video Removed", description: `Video has been unassigned.` });
        // Optimistically update local state or refetch
        setAllUsersForAdmin(prevUsers => prevUsers.map(u => 
            u.id === videoToRemove.assignedToUserId
            ? { ...u, assignedYoutubeUrls: (u.assignedYoutubeUrls || []).filter(url => url !== videoToRemove.url) }
            : u
        ));
        await fetchAndSetVideos(); 
      } else {
        toast({ variant: "destructive", title: "Removal Failed", description: result.error || "Could not unassign video." });
      }
    } catch (error) {
       toast({ variant: "destructive", title: "Error", description: (error as Error).message || "An unexpected error occurred during removal." });
    }
  };

  const columns: ColumnConfig<YoutubeVideo>[] = useMemo(() => [
    {
      key: 'thumbnailUrl',
      header: 'Thumbnail',
      render: (item) => renderImageCell({ thumbnailUrl: item.thumbnailUrl, dataAiHint: item.dataAiHint }, 'thumbnail'),
      className: "w-[100px]"
    },
    { key: 'title', header: 'Title', sortable: true, className: "min-w-[200px] font-medium" },
    { key: 'channelTitle', header: 'Channel', sortable: true, className: "min-w-[120px]" },
    {
      key: 'assignedToUserName',
      header: 'Assigned To',
      render: (item: YoutubeVideo) => (
        <Badge variant="secondary">{item.assignedToUserName || item.assignedToUserId}</Badge>
      ),
      className: "min-w-[150px]"
    },
    {
      key: 'likeCount', header: 'Likes', sortable: true,
      render: (item) => item.likeCount?.toLocaleString() ?? 'N/A', className: "text-right w-[100px]"
    },
    {
      key: 'commentCount', header: 'Comments', sortable: true,
      render: (item) => item.commentCount?.toLocaleString() ?? 'N/A', className: "text-right w-[120px]"
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex justify-center items-center gap-1">
        {(currentUser?.role === 'admin' || currentUser?.id === item.assignedToUserId) && (
          <Button variant="ghost" size="icon" onClick={() => handleRemoveVideo(item)} title="Remove Video Assignment" className="h-8 w-8">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
        <Button variant="ghost" size="icon" asChild title="Open Video in New Tab" className="h-8 w-8">
            <a href={item.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 text-primary" />
            </a>
        </Button>
        </div>
      ),
      className: "text-center w-[100px]"
    }
  ], [currentUser, handleRemoveVideo]); 

  const getTableCaption = () => {
    if (currentUser?.role === 'admin') {
      if (!selectedUserIdForFilter && !isLoadingUsers && !isLoadingPageData) return "Please select an option (a user or 'Show All Videos').";
      if (selectedUserIdForFilter === 'all') {
        if (isLoadingPageData || (isLoadingUsers && allUsersForAdmin.length === 0 && !authLoading)) return "Loading all assigned videos...";
        return displayedVideos.length === 0 ? "No YouTube videos found assigned to any user." : "Showing all videos assigned across all users.";
      }
      const selectedUserDetails = allUsersForAdmin.find(u => u.id === selectedUserIdForFilter);
      const userName = selectedUserDetails ? selectedUserDetails.name : 'the selected user';
      if (isLoadingPageData) return `Loading videos for ${userName}...`;
      return displayedVideos.length === 0 ? `No YouTube videos found assigned to ${userName}.` : `Showing videos assigned to ${userName}.`;
    }
    if (isLoadingPageData) return "Loading your assigned videos...";
    return displayedVideos.length === 0 ? "No YouTube videos have been assigned to you yet." : "Your Assigned YouTube Videos";
  };
  
  const showMainLoader = authLoading || (isLoadingPageData && (!selectedUserIdForFilter || selectedUserIdForFilter === 'all'));
    // More specific condition for "all" if users are still loading for it.
    // if (currentUser?.role === 'admin' && selectedUserIdForFilter === 'all' && isLoadingUsers && allUsersForAdmin.length === 0) {
    //   showMainLoader = true;
    // }


  if (showMainLoader) {
     return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // This will hold the specific message to show when no data is available AND not loading
  const noDataMessageText = !isLoadingPageData && displayedVideos.length === 0 && (currentUser?.role !== 'admin' || !!selectedUserIdForFilter) ? getTableCaption() : null;

  return (
    <DataTableShell
      title="YouTube Video Assignments"
      description={
        currentUser?.role === 'admin'
        ? "Assign YouTube video URLs to users. Select a user or 'Show All' to view assignments. Video details are fetched from YouTube API."
        : "View YouTube videos assigned to you. Video details are fetched from YouTube API."
      }
    >
      {currentUser?.role === 'admin' && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="user-select-filter" className="text-sm font-medium shrink-0">View videos for:</Label>
            {isLoadingUsers ? (
              <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users...</div>
            ) : (
              <Select 
                value={selectedUserIdForFilter} 
                onValueChange={(value) => {
                  console.log("[YouTubePage] Admin selected option from filter dropdown. New selectedUserIdForFilter:", value);
                  setSelectedUserIdForFilter(value);
                }}
              >
                <SelectTrigger id="user-select-filter" className="w-full sm:w-[320px] bg-background shadow-sm">
                  <SelectValue placeholder="-- Select View Option --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Show All Assigned Videos</SelectItem>
                  {allUsersForAdmin.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Dialog open={isAddVideoDialogOpen} onOpenChange={setIsAddVideoDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto" disabled={isLoadingUsers && allUsersForAdmin.length === 0}>
                <PlusCircle className="mr-2 h-4 w-4" /> Assign Video URL
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Assign New YouTube Video URL</DialogTitle>
                <DialogDescription>Enter video URL and assign to a user. The URL will be stored in the user's record. Details are fetched from YouTube API.</DialogDescription>
              </DialogHeader>
              <Form {...addVideoForm}>
                <form onSubmit={addVideoForm.handleSubmit(onSubmitAddVideo)} className="space-y-4 py-4">
                  <FormField
                    control={addVideoForm.control}
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
                    control={addVideoForm.control}
                    name="assignedToUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign to User</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={isSubmittingVideo || isLoadingUsers}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoadingUsers ? "Loading users..." : "Select a user"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allUsersForAdmin.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddVideoDialogOpen(false)} disabled={isSubmittingVideo}>Cancel</Button>
                    <Button type="submit" disabled={isSubmittingVideo || !addVideoForm.formState.isValid}>
                      {isSubmittingVideo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save Assignment
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      )}
      
      {!showMainLoader && noDataMessageText && ( 
        <div className="text-center py-10 text-muted-foreground">
            <Rss className="mx-auto h-12 w-12 mb-3" />
            <p className="text-lg font-semibold mb-1">
                {noDataMessageText.startsWith("Please select") ? "Awaiting Selection" : 
                 noDataMessageText.startsWith("Loading") ? "Loading..." : "No Videos Found"}
            </p>
            <p>{noDataMessageText}</p>
            
            {currentUser?.role === 'admin' && 
             selectedUserIdForFilter && 
             selectedUserIdForFilter !== 'all' && 
             displayedVideos.length === 0 &&
             !isLoadingPageData && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 shadow">
                <p className="font-semibold mb-2">Admin Tip:</p>
                <p>
                  If you're certain this user has videos assigned, the "No Videos Found" message might be due to a missing Firestore index for this specific query.
                </p>
                <p className="mt-2">
                  Please check your browser's developer console (usually F12, then click the "Console" tab) for any error messages from Firestore. 
                  Look for a message that includes a link similar to: 
                  <code className="block bg-blue-100 p-1 rounded text-xs my-1 break-all">https://console.firebase.google.com/project/.../firestore/indexes?create_composite=...</code>
                </p>
                <p className="mt-2">
                  This link will guide you to create the required composite index (usually on the 'assignedToUserId' (Ascending) and 'createdAt' (Descending) fields in the 'users' collection, specifically for the `assignedYoutubeUrls` array if your queries imply ordering or filtering within that array which is not the case here - direct user document fetch is used).
                </p>
                 <p className="mt-2 text-xs">
                    (Note: With the current model of storing URLs in the user document, fetching a specific user's videos relies on getting that user's document. If issues persist for a specific user and you've verified their `assignedYoutubeUrls` array is correctly populated in Firestore, and no console errors appear, the issue might be elsewhere in the data processing or YouTube API fetching step.)
                </p>
              </div>
            )}
        </div>
      )}

      {!showMainLoader && displayedVideos.length > 0 && (
        <GenericDataTable<YoutubeVideo>
          data={displayedVideos}
          columns={columns}
          caption={getTableCaption()}
        />
      )}
    </DataTableShell>
  );
}
    
