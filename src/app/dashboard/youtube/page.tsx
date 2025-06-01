"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable, renderImageCell } from '@/components/analytics/generic-data-table';
import { useAuth } from '@/contexts/auth-context';
import { getFilteredData, mockYoutubeVideos } from '@/lib/mock-data';
import type { ColumnConfig, YoutubeVideo, User } from '@/types';
import { getUsers } from '@/lib/user-service';
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

const columns: ColumnConfig<YoutubeVideo>[] = [
  { 
    key: 'thumbnailUrl', 
    header: 'Thumbnail', 
    render: (item) => renderImageCell(item, 'thumbnail'),
    className: "w-[100px]"
  },
  { key: 'title', header: 'Title', sortable: true, className: "min-w-[200px] font-medium" },
  { key: 'channelTitle', header: 'Channel', sortable: true, className: "min-w-[120px]" },
  { 
    key: 'likeCount', 
    header: 'Likes', 
    sortable: true, 
    render: (item) => item.likeCount.toLocaleString(),
    className: "text-right w-[100px]"
  },
  { 
    key: 'commentCount', 
    header: 'Comments', 
    sortable: true, 
    render: (item) => item.commentCount.toLocaleString(),
    className: "text-right w-[120px]"
  },
  { 
    key: 'shareCount', 
    header: 'Shares', 
    sortable: true, 
    render: (item) => item.shareCount.toLocaleString(),
    className: "text-right w-[100px]"
  },
];

const addVideoSchema = z.object({
  url: z.string().url({ message: "Please enter a valid YouTube URL." }),
  assignedToUserId: z.string().min(1, { message: "Please select a user." }),
});
type AddVideoFormValues = z.infer<typeof addVideoSchema>;

export default function YouTubeAnalyticsPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserIdForFilter, setSelectedUserIdForFilter] = useState<string>('all'); // 'all' or a user ID for filtering
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [isAddVideoDialogOpen, setIsAddVideoDialogOpen] = useState(false);
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);

  // Initialize video list state with mock data
  const [videos, setVideos] = useState<YoutubeVideo[]>(() => getFilteredData(mockYoutubeVideos, currentUser));

  const form = useForm<AddVideoFormValues>({
    resolver: zodResolver(addVideoSchema),
    defaultValues: {
      url: "",
      assignedToUserId: "",
    },
  });
  
  useEffect(() => {
    // Update videos if currentUser changes (e.g. on login/logout or role change if that was possible)
    // This re-applies the initial getFilteredData logic
    setVideos(getFilteredData(mockYoutubeVideos, currentUser));
  }, [currentUser]);


  useEffect(() => {
    if (currentUser?.role === 'admin') {
      setIsLoadingUsers(true);
      getUsers()
        .then(setAllUsers)
        .catch(console.error) // Basic error handling
        .finally(() => setIsLoadingUsers(false));
    }
  }, [currentUser]);

  // Filter displayed videos based on admin's selection and the current 'videos' state
  const displayedVideos = useMemo(() => {
    if (currentUser?.role !== 'admin' || selectedUserIdForFilter === 'all') {
      return videos; // Show videos based on initial user permissions or all from state
    }
    // Admin is viewing a specific user's videos
    return videos.filter(video => video.assignedToUserId === selectedUserIdForFilter);
  }, [videos, selectedUserIdForFilter, currentUser]);

  async function onSubmitAddVideo(data: AddVideoFormValues) {
    setIsSubmittingVideo(true);
    try {
      // Simulate adding a video. In a real app, this would interact with a backend.
      const newVideo: YoutubeVideo = {
        id: `yt_new_${Date.now()}`,
        url: data.url,
        title: `New Video: ${data.url.substring(0, 30)}...`, // Placeholder title
        thumbnailUrl: 'https://placehold.co/320x180.png',
        dataAiHint: 'custom video',
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        channelTitle: 'N/A',
        assignedToUserId: data.assignedToUserId,
      };

      setVideos(prevVideos => [...prevVideos, newVideo]);
      
      toast({
        title: "Video Added (Session Only)",
        description: `Video ${newVideo.url} assigned to user. This change is for the current session only.`,
      });
      form.reset();
      setIsAddVideoDialogOpen(false);

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Adding Video",
        description: "Could not add the video. Please try again.",
      });
      console.error("Error adding video:", error);
    } finally {
      setIsSubmittingVideo(false);
    }
  }

  return (
    <DataTableShell
      title="YouTube Analytics"
      description="Track performance of selected YouTube videos and channels. Admins can assign videos to users."
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
                  <SelectItem value="all">All Assigned Videos (Based on your keywords)</SelectItem>
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
                <DialogTitle>Add/Assign New YouTube Video</DialogTitle>
                <DialogDescription>
                  Enter the YouTube video URL and select a user to assign it to.
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
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmittingVideo || isLoadingUsers}>
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
                    <Button type="submit" disabled={isSubmittingVideo || isLoadingUsers}>
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
      <GenericDataTable<YoutubeVideo>
        data={displayedVideos}
        columns={columns}
        caption="YouTube Video Performance Data"
      />
    </DataTableShell>
  );
}
