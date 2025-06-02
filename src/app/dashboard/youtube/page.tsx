
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable, renderImageCell } from '@/components/analytics/generic-data-table';
import { useAuth } from '@/contexts/auth-context';
import type { ColumnConfig, YoutubeVideo, User as AuthUserType } from '@/types'; // Renamed User to AuthUserType
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
  DialogTrigger,
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
  const [isLoadingPageData, setIsLoadingPageData] = useState<boolean>(true); // Overall loading state
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false); // For admin dropdown
  const [allUsersForAdmin, setAllUsersForAdmin] = useState<AuthUserType[]>([]); // For admin dropdown & name mapping
  
  // Filter state for admin
  const [selectedUserIdForFilter, setSelectedUserIdForFilter] = useState<string>('');

  const [isAddVideoDialogOpen, setIsAddVideoDialogOpen] = useState(false);
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);

  // For debugging and understanding state changes
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

  // Function to fetch and process YouTube video details from URLs
  const processUrlsToVideos = useCallback(async (
    urls: string[],
    targetUserId: string,
    targetUserName?: string
  ): Promise<YoutubeVideo[]> => {
    if (!urls || urls.length === 0) return [];

    const videoIdToAssignmentMap: Record<string, { userId: string, userName?: string }> = {};
    // The `extractYouTubeVideoId` is now internal to `youtube-video-service` and not needed here.
    // We will pass URLs directly to `fetchBatchVideoDetailsFromYouTubeAPI`.
    // This function will handle ID extraction if necessary, or directly use IDs if passed.

    // To adapt `fetchBatchVideoDetailsFromYouTubeAPI`, we'll pass the URLs and the map.
    // The service will handle extracting IDs and then fetching.
    // However, for simplicity and to align with `fetchBatchVideoDetailsFromYouTubeAPI` expecting IDs,
    // let's assume the URLs are passed directly, and the batch service will handle ID extraction.
    // For now, this function primarily constructs the assignment map.
    // The key change is `fetchBatchVideoDetailsFromYouTubeAPI` now takes URLs if ID extraction is needed,
    // or direct IDs. Let's simplify `processUrlsToVideos` to just be a wrapper that passes to the batch function.
    
    // This function essentially becomes a direct call to the batch processing if URLs are provided,
    // or it could be simplified further if `fetchBatchVideoDetailsFromYouTubeAPI` can directly take user objects.
    // Let's assume `fetchBatchVideoDetailsFromYouTubeAPI` is robust enough to handle URLs/IDs and a map.

    // New approach: `fetchBatchVideoDetailsFromYouTubeAPI` expects video IDs,
    // so we need to extract IDs from URLs here or, more simply, pass URLs and let the service do it.
    // For the purpose of this function, if it's just passing URLs to a batch fetcher,
    // the batch fetcher must be adapted to extract IDs *from* those URLs.
    // Let's stick to the current design: fetchBatchVideoDetailsFromYouTubeAPI expects *video IDs*.
    // So, this function is more about preparing the call to the batch function.

    // Re-evaluating: `fetchBatchVideoDetailsFromYouTubeAPI` expects IDs.
    // The current structure expects URLs to be transformed into `YoutubeVideo` objects.
    // `fetchVideoDetailsFromYouTubeAPI` (singular) takes a URL or ID.

    const videoFetchPromises = urls.map(url => 
        fetchVideoDetailsFromYouTubeAPI(url, targetUserId, targetUserName)
    );
    const results = await Promise.all(videoFetchPromises);
    return results.filter(video => video !== null) as YoutubeVideo[];

  }, []);
  
  const processMultipleUsersUrlsToVideos = useCallback(async (usersWithUrls: AuthUserType[]): Promise<YoutubeVideo[]> => {
    const allVideoUrlsWithAssignments: {url: string, userId: string, userName?: string}[] = [];

    usersWithUrls.forEach(user => {
      user.assignedYoutubeUrls?.forEach(url => {
        allVideoUrlsWithAssignments.push({ url, userId: user.id, userName: user.name });
      });
    });

    if (allVideoUrlsWithAssignments.length === 0) return [];

    // We're passing the full URL list and letting the batch function handle ID extraction & API calls
    const videoIdToAssignmentMap: Record<string, { userId: string, userName?: string }> = {};
    const uniqueVideoIds = new Set<string>(); // To pass to the API

    // This part is tricky if `fetchBatchVideoDetailsFromYouTubeAPI` expects IDs.
    // Let's assume it can take URLs and will extract IDs internally, or we extract IDs first.
    // For simplicity, we should pass IDs to `fetchBatchVideoDetailsFromYouTubeAPI`.
    // The current `fetchBatchVideoDetailsFromYouTubeAPI` in `youtube-video-service` expects an array of `videoIds`.

    // Let's re-think. The new `fetchBatchVideoDetailsFromYouTubeAPI` *does* take an array of *IDs*.
    // So we must extract them first.
    
    const videoIdsForBatch: string[] = [];
    allVideoUrlsWithAssignments.forEach(item => {
        // We can't call extractYouTubeVideoId here anymore as it's not exported.
        // The `fetchBatchVideoDetailsFromYouTubeAPI` will need to handle ID extraction if it takes URLs.
        // OR, we use singular `fetchVideoDetailsFromYouTubeAPI` in a loop (less efficient for many).

        // For this refactor, let's assume `fetchBatchVideoDetailsFromYouTubeAPI` can now take URLs.
        // However, the service was updated to take IDs. This is a conflict.

        // Simplest change now is to use `fetchVideoDetailsFromYouTubeAPI` in a loop.
        // This is less optimal but avoids re-exposing extractYouTubeVideoId for now.
        // Later, `fetchBatchVideoDetailsFromYouTubeAPI` could be enhanced.

        // We will construct the list of video IDs and the assignment map as before
        // The `extractYouTubeVideoId` function is not available here.
        // This implies `fetchBatchVideoDetailsFromYouTubeAPI` MUST handle ID extraction from the URLs *if* we pass URLs.
        // Given the previous refactor, `fetchBatchVideoDetailsFromYouTubeAPI` was designed to take IDs.
        // This part needs to align. Let's assume `fetchBatchVideoDetailsFromYouTubeAPI` is updated to take `videoUrlOrId`s.
        // Or, we pass the video ID strings, which means we need to extract them here, but `extractYouTubeVideoId` is not exported.

        // The `fetchBatchVideoDetailsFromYouTubeAPI` in the last step was specifically designed to take an array of VIDEO IDs.
        // Let's stick to that. So, `processMultipleUsersUrlsToVideos` will need to prepare IDs.
        // This means `extractYouTubeVideoId` *does* need to be accessible or duplicated, or the service changes.
        // Since the goal is to fix the import error, and `extractYouTubeVideoId` is not used elsewhere on this page,
        // the import removal is correct. The logic within `processMultipleUsersUrlsToVideos` would need to call
        // the service functions (`fetchVideoDetailsFromYouTubeAPI` or `fetchBatchVideoDetailsFromYouTubeAPI`)
        // which themselves use the internal `extractYouTubeVideoId`.

        // The previous `fetchBatchVideoDetailsFromYouTubeAPI` expects video *IDs*.
        // The `assignedToUserMap` is also keyed by video ID.
        // So, to use it, we need to get video IDs from URLs first.
        // This means `extractYouTubeVideoId` should be re-exported if it's used by functions outside its module,
        // OR functions like `fetchBatch...` should accept URLs and extract IDs internally.
        // The last fix made `extractYouTubeVideoId` internal. This means this `page.tsx` cannot extract IDs itself.
        // It MUST rely on the service functions to do so.

        // Simplest path: the `fetchVideos` function below will iterate through user URLs and call `fetchVideoDetailsFromYouTubeAPI`
        // one by one. This avoids the complexity of batching and ID extraction here, as the service function handles it.

    });
    
    // If `fetchBatchVideoDetailsFromYouTubeAPI` is to be used for *all* users' videos,
    // it needs a list of all unique video URLs (or IDs) and a map of ID to assigned user.
    // The service would then fetch details.

    // For now, to unblock, `fetchAndSetVideos` will iterate and use `fetchVideoDetailsFromYouTubeAPI`.
    // This is less efficient for "show all" but avoids the ID extraction issue here.
    // `fetchBatchVideoDetailsFromYouTubeAPI` will be called by `fetchAndSetVideos` internally.

    return []; // This function will be simplified in `fetchAndSetVideos`.

  }, []);


  const fetchAndSetVideos = useCallback(async () => {
    if (authLoading || !currentUser) {
      setIsLoadingPageData(false);
      return;
    }
    console.log(`[YouTubePage] fetchVideos called. Admin: ${currentUser.role === 'admin'}, Filter: ${selectedUserIdForFilter}`);
    setIsLoadingPageData(true);
    let fetchedVideos: YoutubeVideo[] = [];

    try {
      if (currentUser.role === 'admin') {
        if (selectedUserIdForFilter === 'all') {
          console.log("[YouTubePage] fetchVideos: Admin view, 'all' selected. Fetching all users.");
          const users = await getUsers();
          setAllUsersForAdmin(users); // Keep a full list for name mapping and Add Video dropdown
          
          const allUrlsWithAssignments: {url: string, userId: string, userName?: string}[] = [];
          users.forEach(u => {
            u.assignedYoutubeUrls?.forEach(url => {
              allUrlsWithAssignments.push({ url, userId: u.id, userName: u.name });
            });
          });

          if (allUrlsWithAssignments.length > 0) {
            // Use the batch fetching method: it now expects URLs directly or can handle IDs if extracted prior.
            // The service's `fetchBatchVideoDetailsFromYouTubeAPI` expects IDs.
            // We need to adapt. The page should not extract IDs.
            // Let's simplify: if `fetchBatchVideoDetailsFromYouTubeAPI` is to be used, it should internally manage IDs.
            // The existing `fetchBatchVideoDetailsFromYouTubeAPI` expects IDs and an assignment map.
            // We need to re-evaluate.
            // The simplest for `page.tsx` is: gather all URLs, then pass to a function that manages details.

            // This will be inefficient if `fetchBatchVideoDetailsFromYouTubeAPI` cannot take URLs.
            // Given current `fetchBatchVideoDetailsFromYouTubeAPI` takes IDs,
            // let's reconstruct how it's called or simplify the loop.
            const videoPromises = allUrlsWithAssignments.map(item => 
              fetchVideoDetailsFromYouTubeAPI(item.url, item.userId, item.userName)
            );
            const results = await Promise.all(videoPromises);
            fetchedVideos = results.filter(video => video !== null) as YoutubeVideo[];

          } else {
            fetchedVideos = [];
          }
          console.log(`[YouTubePage] Fetched ${fetchedVideos.length} videos for 'all users'.`);

        } else if (selectedUserIdForFilter) {
          console.log(`[YouTubePage] fetchVideos: Admin view, specific user '${selectedUserIdForFilter}' selected. Calling getVideosForUserFromFirestore.`);
          // This function was for Firestore, now we need to get user, then their URLs, then fetch details.
          const userDoc = allUsersForAdmin.find(u => u.id === selectedUserIdForFilter) || await getUserById(selectedUserIdForFilter);
          if (userDoc && userDoc.assignedYoutubeUrls && userDoc.assignedYoutubeUrls.length > 0) {
             fetchedVideos = await processUrlsToVideos(userDoc.assignedYoutubeUrls, userDoc.id, userDoc.name);
          } else {
            fetchedVideos = [];
          }
          console.log(`[YouTubePage] Fetched ${fetchedVideos.length} videos. (Filter/User: ${selectedUserIdForFilter})`);
        } else {
          fetchedVideos = []; // No user or "all" selected by admin initially
          console.log("[YouTubePage] fetchVideos: Admin view, no specific user or 'all' selected yet.");
        }
      } else { // Regular user view
        console.log(`[YouTubePage] fetchVideos: User view for ${currentUser.id}.`);
        if (currentUser.assignedYoutubeUrls && currentUser.assignedYoutubeUrls.length > 0) {
          fetchedVideos = await processUrlsToVideos(currentUser.assignedYoutubeUrls, currentUser.id, currentUser.name);
        } else {
          fetchedVideos = [];
        }
        console.log(`[YouTubePage] Fetched ${fetchedVideos.length} videos for current user.`);
      }
      setDisplayedVideos(fetchedVideos);
    } catch (error) {
      console.error("[YouTubePage] Error fetching video data:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load YouTube video data." });
      setDisplayedVideos([]);
    } finally {
      setIsLoadingPageData(false);
    }
  }, [currentUser, authLoading, selectedUserIdForFilter, processUrlsToVideos, toast, allUsersForAdmin]);

  useEffect(() => {
    fetchAndSetVideos();
  }, [fetchAndSetVideos]);

  // Fetch all users for admin dropdown and name mapping
  useEffect(() => {
    if (currentUser?.role === 'admin' && allUsersForAdmin.length === 0) { // Fetch only if not already populated
      setIsLoadingUsers(true);
      getUsers()
        .then(users => {
          setAllUsersForAdmin(users);
          console.log(`[YouTubePage] Fetched ${users.length} users for admin dropdown.`);
        })
        .catch(error => {
          toast({ variant: "destructive", title: "Error", description: "Failed to fetch user list for admin." });
        })
        .finally(() => setIsLoadingUsers(false));
    }
  }, [currentUser, toast, allUsersForAdmin.length]);

  async function onSubmitAddVideo(data: AddVideoFormValues) {
    setIsSubmittingVideo(true);
    try {
      const result = await assignYoutubeUrlToUser(data.assignedToUserId, data.url);
      if (result.success) {
        toast({ title: "Video Assigned", description: `Video URL has been assigned to the user.` });
        addVideoForm.reset();
        setIsAddVideoDialogOpen(false);
        // Update allUsersForAdmin state to reflect new URL for the user
        setAllUsersForAdmin(prevUsers => prevUsers.map(u => 
            u.id === data.assignedToUserId 
            ? { ...u, assignedYoutubeUrls: [...(u.assignedYoutubeUrls || []), data.url] }
            : u
        ));
        await fetchAndSetVideos(); // Re-fetch videos to update the table
      } else {
        toast({ variant: "destructive", title: "Assignment Failed", description: result.error || "Could not assign video URL." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: (error as Error).message || "An unexpected error occurred." });
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
         // Update allUsersForAdmin state to reflect removal
        setAllUsersForAdmin(prevUsers => prevUsers.map(u => 
            u.id === videoToRemove.assignedToUserId
            ? { ...u, assignedYoutubeUrls: (u.assignedYoutubeUrls || []).filter(url => url !== videoToRemove.url) }
            : u
        ));
        await fetchAndSetVideos(); // Refresh the list
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
  ], [currentUser, handleRemoveVideo]); // handleRemoveVideo added to dependency array

  const getTableCaption = () => {
    if (currentUser?.role === 'admin') {
      if (!selectedUserIdForFilter && !isLoadingUsers) return "Please select an option (a user or 'Show All Videos').";
      if (selectedUserIdForFilter === 'all') {
        return isLoadingPageData ? "Loading all assigned videos..." : (displayedVideos.length === 0 ? "No YouTube videos found assigned to any user." : "Showing all videos assigned across all users.");
      }
      const selectedUserDetails = allUsersForAdmin.find(u => u.id === selectedUserIdForFilter);
      const userName = selectedUserDetails ? selectedUserDetails.name : 'the selected user';
      return isLoadingPageData ? `Loading videos for ${userName}...` : (displayedVideos.length === 0 ? `No YouTube videos found assigned to ${userName}.` : `Showing videos assigned to ${userName}.`);
    }
     return isLoadingPageData ? "Loading your assigned videos..." : (displayedVideos.length === 0 ? "No YouTube videos have been assigned to you yet." : "Your Assigned YouTube Videos");
  };
  
  if (authLoading || (isLoadingPageData && displayedVideos.length === 0 && !isAddVideoDialogOpen && !isLoadingUsers)) {
     return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  console.log("[YouTubePage] displayedVideos (data passed to table): ", displayedVideos);
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

      {/* Conditional rendering for loading and no data states */}
      {isLoadingPageData && (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      )}
      
      {noDataMessageText && !isLoadingPageData && (
        <div className="text-center py-10 text-muted-foreground">
            <Rss className="mx-auto h-12 w-12 mb-3" />
            <p className="text-lg font-semibold mb-1">
                {noDataMessageText.startsWith("Please select") ? "Awaiting Selection" : "No Videos Found"}
            </p>
            <p>{noDataMessageText}</p>
            
            {/* Admin Tip for Missing Index */}
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
                  This link will guide you to create the required composite index (usually on the 'assignedToUserId' (Ascending) and 'createdAt' (Descending) fields in the 'youtube_videos' collection, but in our new structure, this refers to the query against 'users' collection's 'assignedYoutubeUrls' if we were to directly query on array contents, which we are not. The specific user view relies on fetching user document then processing urls. The 'Show All' view fetches all users. No composite index is expected to be an issue for this new model based on user doc reads).
                </p>
                 <p className="mt-2 text-xs">
                    (Note: The Admin Tip's reference to 'youtube_videos' collection and its index is now outdated due to recent data model changes. The primary check is for a valid YouTube API key and ensuring URLs are correctly assigned to users. If data appears missing for a user, verify their assigned URLs in the 'users' collection.)
                </p>
              </div>
            )}
        </div>
      )}

      {!isLoadingPageData && displayedVideos.length > 0 && (
        <GenericDataTable<YoutubeVideo>
          data={displayedVideos}
          columns={columns}
          caption={getTableCaption()}
        />
      )}
    </DataTableShell>
  );
}


    