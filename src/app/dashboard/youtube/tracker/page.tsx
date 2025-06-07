
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable, renderImageCell } from '@/components/analytics/generic-data-table';
import { useAuth } from '@/contexts/auth-context';
import type { ColumnConfig, YoutubeVideo, User as AuthUserType } from '@/types';
import { getUsers, assignYoutubeUrlToUser, removeYoutubeUrlFromUser, getUserById } from '@/lib/user-service';
import { fetchBatchVideoDetailsFromYouTubeAPI } from '@/lib/youtube-video-service'; // Keep this for assigned videos
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
import { PlusCircle, Loader2, Rss, Trash2, ExternalLink, Eye, ThumbsUp, MessageSquare } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import YouTubeAnalyticsSummary from '@/components/dashboard/YouTubeAnalyticsSummary';

const addVideoSchema = z.object({
  url: z.string().url({ message: "Please enter a valid YouTube URL." }),
  assignedToUserId: z.string().min(1, { message: "Please select a user." }),
});
type AddVideoFormValues = z.infer<typeof addVideoSchema>;

export default function YouTubeAssignedTrackerPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [displayedVideos, setDisplayedVideos] = useState<YoutubeVideo[]>([]);
  const [isLoadingPageData, setIsLoadingPageData] = useState<boolean>(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [allUsersForAdmin, setAllUsersForAdmin] = useState<AuthUserType[]>([]);
  const [selectedUserIdForFilter, setSelectedUserIdForFilter] = useState<string>('');
  const [isAddVideoDialogOpen, setIsAddVideoDialogOpen] = useState(false);
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);

  const addVideoForm = useForm<AddVideoFormValues>({
    resolver: zodResolver(addVideoSchema),
    defaultValues: { url: "", assignedToUserId: "" },
  });

  const processAndFetchVideoDetails = useCallback(async (
    urls: string[],
    assignmentMap: Record<string, { userId: string, userName?: string }>
  ): Promise<YoutubeVideo[]> => {
    if (!urls || urls.length === 0) return [];
    const videoIds = urls.map(url => {
        try {
            return new URL(url).searchParams.get('v') || new URL(url).pathname.split('/').pop();
        } catch (e) { return null; }
    }).filter(Boolean) as string[];

    if(videoIds.length === 0) return [];
    const videoDetails = await fetchBatchVideoDetailsFromYouTubeAPI(videoIds, assignmentMap);
    return videoDetails;
  }, []);

  const fetchAndSetAssignedVideos = useCallback(async () => {
    if (authLoading || !currentUser) {
      setDisplayedVideos([]);
      setIsLoadingPageData(false);
      return;
    }
    setIsLoadingPageData(true);
    let fetchedVideos: YoutubeVideo[] = [];

    try {
      if (currentUser.role === 'admin') {
        if (isLoadingUsers && selectedUserIdForFilter === 'all' && allUsersForAdmin.length === 0) { setIsLoadingPageData(false); return; }
        const videoIdToAssignmentMap: Record<string, { userId: string, userName?: string }> = {};
        const urlsToFetch: string[] = [];

        const usersToProcess = selectedUserIdForFilter === 'all' 
          ? allUsersForAdmin 
          : selectedUserIdForFilter 
            ? [allUsersForAdmin.find(u => u.id === selectedUserIdForFilter) || await getUserById(selectedUserIdForFilter)].filter(Boolean) as AuthUserType[]
            : [];
        
        usersToProcess.forEach(u => {
          u.assignedYoutubeUrls?.forEach(url => {
            try {
                const videoId = new URL(url).searchParams.get('v') || new URL(url).pathname.split('/').pop();
                if (videoId) { if (!videoIdToAssignmentMap[videoId]) { urlsToFetch.push(url); videoIdToAssignmentMap[videoId] = { userId: u.id, userName: u.name }; } }
            } catch (e) { console.warn("Invalid URL in assignedYoutubeUrls:", url); }
          });
        });
        if (urlsToFetch.length > 0) fetchedVideos = await processAndFetchVideoDetails(urlsToFetch, videoIdToAssignmentMap); else fetchedVideos = [];
      } else { 
        const videoIdToAssignmentMap: Record<string, { userId: string, userName?: string }> = {};
        const urlsToFetch: string[] = [];
        if (currentUser.assignedYoutubeUrls && currentUser.assignedYoutubeUrls.length > 0) {
            currentUser.assignedYoutubeUrls.forEach(url => {
              try {
                const videoId = new URL(url).searchParams.get('v') || new URL(url).pathname.split('/').pop();
                if (videoId) { urlsToFetch.push(url); videoIdToAssignmentMap[videoId] = { userId: currentUser.id, userName: currentUser.name }; }
              } catch (e) { console.warn("Invalid URL in user's assignedYoutubeUrls:", url); }
            });
            if (urlsToFetch.length > 0) fetchedVideos = await processAndFetchVideoDetails(urlsToFetch, videoIdToAssignmentMap);
        }
      }
      setDisplayedVideos(fetchedVideos);
    } catch (error) {
      console.error("[YouTubeTrackerPage] Error fetching or processing assigned video data:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load assigned YouTube video data." });
      setDisplayedVideos([]);
    } finally {
        setIsLoadingPageData(false);
    }
  }, [currentUser, authLoading, selectedUserIdForFilter, processAndFetchVideoDetails, toast, allUsersForAdmin, isLoadingUsers]);

  useEffect(() => {
    fetchAndSetAssignedVideos();
  }, [fetchAndSetAssignedVideos]);

  useEffect(() => { 
    if (currentUser?.role === 'admin' && !isLoadingUsers && allUsersForAdmin.length === 0) { 
      setIsLoadingUsers(true); 
      getUsers().then(users => { setAllUsersForAdmin(users); }).catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to fetch user list." })).finally(() => setIsLoadingUsers(false)); 
    } else if (currentUser?.role === 'admin' && allUsersForAdmin.length > 0 && isLoadingUsers) { 
      setIsLoadingUsers(false); 
    } 
  }, [currentUser, toast, allUsersForAdmin.length, isLoadingUsers]);

  async function onSubmitAddVideo(data: AddVideoFormValues) {
    setIsSubmittingVideo(true);
    try {
      let videoId: string | null = null;
      try {
          videoId = new URL(data.url).searchParams.get('v') || new URL(data.url).pathname.split('/').pop();
      } catch (e) { /* Invalid URL handled below */ }

      if (!videoId) { toast({ variant: "destructive", title: "Invalid URL", description: "Could not extract video ID." }); setIsSubmittingVideo(false); return; }
      
      const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const result = await assignYoutubeUrlToUser(data.assignedToUserId, canonicalUrl);
      if (result.success) {
        toast({ title: "Video Assigned", description: `Video URL assigned.` });
        addVideoForm.reset(); setIsAddVideoDialogOpen(false);
        if (currentUser?.role === 'admin') {
          setAllUsersForAdmin(prev => prev.map(u => u.id === data.assignedToUserId ? { ...u, assignedYoutubeUrls: [...(u.assignedYoutubeUrls || []), canonicalUrl].filter((v,i,a)=>a.indexOf(v)===i) } : u));
        }
        await fetchAndSetAssignedVideos(); 
      } else { toast({ variant: "destructive", title: "Assignment Failed", description: result.error || "Could not assign video." }); }
    } catch (error) { let m = error instanceof Error ? error.message : "An unexpected error."; if (error instanceof Error && error.message.includes("Invalid URL")) m = "Invalid YouTube URL."; toast({ variant: "destructive", title: "Error", description: m });
    } finally { setIsSubmittingVideo(false); }
  }

  const handleRemoveVideo = async (videoToRemove: YoutubeVideo) => {
     if (!confirm(`Remove "${videoToRemove.title || videoToRemove.url}" for ${videoToRemove.assignedToUserName || videoToRemove.assignedToUserId}?`)) return;
    try {
      const result = await removeYoutubeUrlFromUser(videoToRemove.assignedToUserId, videoToRemove.url);
      if (result.success) {
        toast({ title: "Video Removed", description: `Video unassigned.` });
         if (currentUser?.role === 'admin') {
          setAllUsersForAdmin(prev => prev.map(u => u.id === videoToRemove.assignedToUserId ? { ...u, assignedYoutubeUrls: (u.assignedYoutubeUrls || []).filter(url => url !== videoToRemove.url) } : u));
        }
        await fetchAndSetAssignedVideos();
      } else { toast({ variant: "destructive", title: "Removal Failed", description: result.error || "Could not unassign." }); }
    } catch (e) { toast({ variant: "destructive", title: "Error", description: (e as Error).message || "Unexpected error." }); }
  };

  const columns: ColumnConfig<YoutubeVideo>[] = useMemo(() => [
    { key: 'thumbnailUrl', header: 'Thumbnail', render: (item) => renderImageCell({ thumbnailUrl: item.thumbnailUrl, dataAiHint: item.dataAiHint }, 'thumbnail'), className: "w-[100px]" },
    { key: 'title', header: 'Title', sortable: true, className: "min-w-[200px] font-medium" },
    { key: 'channelTitle', header: 'Channel', sortable: true, className: "min-w-[120px]" },
    { key: 'assignedToUserName', header: 'Assigned To', render: (item: YoutubeVideo) => (<Badge variant="secondary">{item.assignedToUserName || item.assignedToUserId}</Badge>), className: "min-w-[150px]" },
    { key: 'viewCount', header: 'Views', sortable: true, render: (item) => <div className="flex items-center justify-end gap-1"><Eye className="h-3.5 w-3.5 text-muted-foreground"/>{item.viewCount?.toLocaleString() ?? 'N/A'}</div>, className: "text-right w-[120px]" },
    { key: 'likeCount', header: 'Likes', sortable: true, render: (item) => <div className="flex items-center justify-end gap-1"><ThumbsUp className="h-3.5 w-3.5 text-muted-foreground"/>{item.likeCount?.toLocaleString() ?? 'N/A'}</div>, className: "text-right w-[120px]" },
    { key: 'commentCount', header: 'Comments', sortable: true, render: (item) => <div className="flex items-center justify-end gap-1"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground"/>{item.commentCount?.toLocaleString() ?? 'N/A'}</div>, className: "text-right w-[120px]" },
    { key: 'sentiment', header: 'Sentiment', render: (item) => { if (!item.sentiment) return <Badge variant="outline">N/A</Badge>; let v: "default" | "destructive" | "secondary" = "secondary"; switch (item.sentiment) { case 'positive': v="default"; break; case 'negative': v="destructive"; break; case 'neutral': v="secondary"; break; } return (<Badge variant={v}>{item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1)}</Badge>); }, className: "w-[120px]" },
    { key: 'actions', header: 'Actions', render: (item) => (<div className="flex justify-center items-center gap-1"> {(currentUser?.role === 'admin' || currentUser?.id === item.assignedToUserId) && (<Button variant="ghost" size="icon" onClick={() => handleRemoveVideo(item)} title="Remove Video Assignment" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>)} <Button variant="ghost" size="icon" asChild title="Open Video" className="h-8 w-8"><a href={item.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 text-primary" /></a></Button></div>), className: "text-center w-[100px]" }
  ], [currentUser, handleRemoveVideo]);

  const getTableCaption = () => {
    if (currentUser?.role === 'admin') {
      if (!selectedUserIdForFilter && !isLoadingUsers && !isLoadingPageData) return "Please select an option (a user or 'Show All Videos').";
      if (selectedUserIdForFilter === 'all') { if (isLoadingPageData || (isLoadingUsers && allUsersForAdmin.length === 0 && !authLoading)) return "Loading all assigned videos..."; return displayedVideos.length === 0 ? "No YouTube videos found assigned to any user." : "Showing all videos assigned across all users."; }
      const userDetails = allUsersForAdmin.find(u => u.id === selectedUserIdForFilter);
      const name = userDetails ? userDetails.name : 'the selected user';
      if (isLoadingPageData) return `Loading videos for ${name}...`;
      return displayedVideos.length === 0 ? `No YouTube videos found assigned to ${name}.` : `Showing videos assigned to ${name}.`;
    }
    if (isLoadingPageData) return "Loading your assigned videos...";
    return displayedVideos.length === 0 ? "No YouTube videos have been assigned to you yet." : "Your Assigned YouTube Videos";
  };

  const showMainLoader = authLoading || (isLoadingPageData && (currentUser?.role !== 'admin' || !selectedUserIdForFilter || (selectedUserIdForFilter === 'all' && (isLoadingUsers || allUsersForAdmin.length === 0))));

  if (showMainLoader) { return (<div className="flex h-[calc(100vh-10rem)] items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>); }

  const noDataMessageText = !isLoadingPageData && displayedVideos.length === 0 && (currentUser?.role !== 'admin' || !!selectedUserIdForFilter) ? getTableCaption() : null;

  return (
    <div className="space-y-6">
      <YouTubeAnalyticsSummary videos={displayedVideos} />
      <DataTableShell
        title="Assigned YouTube Video Tracker"
        description={ currentUser?.role === 'admin' ? "Assign YouTube video URLs to users. Select a user or 'Show All' to view assignments." : "View YouTube videos assigned to you." }
      >
        {currentUser?.role === 'admin' && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="user-select-filter" className="text-sm font-medium shrink-0">View videos for:</Label>
              {isLoadingUsers && allUsersForAdmin.length === 0 ? (<div className="flex items-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users...</div>
              ) : (
                <Select value={selectedUserIdForFilter} onValueChange={(value) => { setSelectedUserIdForFilter(value); }}>
                  <SelectTrigger id="user-select-filter" className="w-full sm:w-[320px] bg-background shadow-sm"><SelectValue placeholder="-- Select View Option --" /></SelectTrigger>
                  <SelectContent> <SelectItem value="all">Show All Assigned Videos</SelectItem> {allUsersForAdmin.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>))} </SelectContent>
                </Select>
              )}
            </div>
            <Dialog open={isAddVideoDialogOpen} onOpenChange={setIsAddVideoDialogOpen}>
              <DialogTrigger asChild><Button className="w-full sm:w-auto" disabled={isLoadingUsers && allUsersForAdmin.length === 0}><PlusCircle className="mr-2 h-4 w-4" /> Assign Video URL</Button></DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader><DialogTitle>Assign New YouTube Video URL</DialogTitle><DialogDescription>Enter video URL and assign to a user.</DialogDescription></DialogHeader>
                <Form {...addVideoForm}>
                  <form onSubmit={addVideoForm.handleSubmit(onSubmitAddVideo)} className="space-y-4 py-4">
                    <FormField control={addVideoForm.control} name="url" render={({ field }) => (<FormItem><FormLabel>YouTube Video URL</FormLabel><FormControl><Input placeholder="https://www.youtube.com/watch?v=..." {...field} disabled={isSubmittingVideo} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={addVideoForm.control} name="assignedToUserId" render={({ field }) => (<FormItem><FormLabel>Assign to User</FormLabel><Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={isSubmittingVideo || isLoadingUsers}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingUsers ? "Loading..." : "Select a user"} /></SelectTrigger></FormControl><SelectContent>{allUsersForAdmin.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <DialogFooter><Button type="button" variant="outline" onClick={() => setIsAddVideoDialogOpen(false)} disabled={isSubmittingVideo}>Cancel</Button><Button type="submit" disabled={isSubmittingVideo || !addVideoForm.formState.isValid}>{isSubmittingVideo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save Assignment</Button></DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        )}
        {!showMainLoader && noDataMessageText && (
          <div className="text-center py-10 text-muted-foreground"> <Rss className="mx-auto h-12 w-12 mb-3" /> <p className="text-lg font-semibold mb-1">{noDataMessageText.startsWith("Please select") ? "Awaiting Selection" : noDataMessageText.startsWith("Loading") ? "Loading..." : "No Videos Found"}</p> <p>{noDataMessageText}</p> </div>
        )}
        {!showMainLoader && displayedVideos.length > 0 && ( <GenericDataTable<YoutubeVideo> data={displayedVideos} columns={columns} caption={getTableCaption()} /> )}
      </DataTableShell>
    </div>
  );
}
