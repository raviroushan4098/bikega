
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
  assignedToUserId: z.string().min(1, { message: "Please select a user." }),
});
type AddVideoFormValues = z.infer<typeof addVideoSchema>;

export default function YouTubeAnalyticsPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [selectedUserIdForFilter, setSelectedUserIdForFilter] = useState<string>('all');
  
  const [isAddVideoDialogOpen, setIsAddVideoDialogOpen] = useState(false);
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);

  const form = useForm<AddVideoFormValues>({
    resolver: zodResolver(addVideoSchema),
    defaultValues: {
      url: "",
      assignedToUserId: "",
    },
  });

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
        if (!item.assignedToUserId) return <Badge variant="outline">Unassigned</Badge>;
        const user = allUsers.find(u => u.id === item.assignedToUserId);
        return user ? <Badge variant="secondary">{user.name}</Badge> : <Badge variant="outline" className="text-xs">{item.assignedToUserId}</Badge>;
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
      render: (item) => new Date(item.createdAt).toLocaleDateString(),
      className: "w-[120px]"
    }
  ], [allUsers]);


  const fetchVideos = useCallback(async () => {
    setIsLoadingVideos(true);
    try {
      const filterId = currentUser?.role === 'admin' && selectedUserIdForFilter !== 'all' 
                       ? selectedUserIdForFilter 
                       : currentUser?.role === 'user' ? currentUser.id : undefined;
      const fetchedVideos = await getYoutubeVideosFromFirestore(filterId);
      setVideos(fetchedVideos);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch videos from Firestore." });
    } finally {
      setIsLoadingVideos(false);
    }
  }, [currentUser, selectedUserIdForFilter, toast]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      setIsLoadingUsers(true);
      getUsers()
        .then(setAllUsers)
        .catch(error => {
          console.error("Failed to fetch users for admin dropdown:", error)
          toast({ variant: "destructive", title: "Error", description: "Failed to fetch users list." });
        })
        .finally(() => setIsLoadingUsers(false));
    }
  }, [currentUser, toast]);

  async function onSubmitAddVideo(data: AddVideoFormValues) {
    setIsSubmittingVideo(true);
    try {
      await addYoutubeVideoToFirestore(data.url, data.assignedToUserId);
      toast({
        title: "Video Assigned",
        description: `Video from ${data.url} has been assigned and saved.`,
      });
      form.reset();
      setIsAddVideoDialogOpen(false);
      fetchVideos(); // Refresh video list
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Assigning Video",
        description: (error as Error).message || "Could not assign the video. Please try again.",
      });
      console.error("Error assigning video:", error);
    } finally {
      setIsSubmittingVideo(false);
    }
  }

  const displayedVideos = useMemo(() => {
    return videos;
  }, [videos]);


  if (isLoadingVideos && videos.length === 0 && !currentUser) { 
     return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // Early return for loading state or non-admin user if necessary user data isn't ready
  if (!currentUser || (currentUser.role === 'admin' && isLoadingUsers && allUsers.length === 0 && !isAddVideoDialogOpen)) {
     return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <DataTableShell
      title="YouTube Analytics (Firestore)"
      description="Track performance of YouTube videos. Admins can assign videos to users, saved in Firestore."
    >
      {currentUser?.role === 'admin' && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="user-select-filter" className="text-sm font-medium shrink-0">View videos assigned to:</Label>
            {isLoadingUsers ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Select value={selectedUserIdForFilter} onValueChange={setSelectedUserIdForFilter}>
                <SelectTrigger id="user-select-filter" className="w-full sm:w-[280px] bg-background shadow-sm">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assigned Videos</SelectItem>
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
              <Button className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Add/Assign Video
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Add & Assign New YouTube Video</DialogTitle>
                <DialogDescription>
                  Enter video URL and assign to a user. Data saved to Firestore.
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
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={isSubmittingVideo || isLoadingUsers}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoadingUsers ? "Loading users..." : "Select a user"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingUsers && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                            {!isLoadingUsers && allUsers.length === 0 && <SelectItem value="no-users" disabled>No users available</SelectItem>}
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
                    <Button type="submit" disabled={isSubmittingVideo || isLoadingUsers || isSubmittingVideo}>
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
          caption="YouTube Video Performance Data (from Firestore)"
        />
      )}
    </DataTableShell>
  );
}
