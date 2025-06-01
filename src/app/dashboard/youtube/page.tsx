
"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
import { Loader2 } from 'lucide-react';

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

export default function YouTubeAnalyticsPage() {
  const { user: currentUser } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all'); // 'all' or a user ID
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      setIsLoadingUsers(true);
      getUsers()
        .then(setAllUsers)
        .catch(console.error) // Basic error handling
        .finally(() => setIsLoadingUsers(false));
    }
  }, [currentUser]);

  // Base data filtered by logged-in user's permissions (admin sees all, user sees keyword-filtered)
  const initialYoutubeData = useMemo(() => {
    return getFilteredData(mockYoutubeVideos, currentUser);
  }, [currentUser]);

  // Further filter based on admin's selection in the dropdown
  const displayedVideos = useMemo(() => {
    if (currentUser?.role !== 'admin' || selectedUserId === 'all') {
      return initialYoutubeData;
    }
    return initialYoutubeData.filter(video => video.assignedToUserId === selectedUserId);
  }, [initialYoutubeData, selectedUserId, currentUser]);

  return (
    <DataTableShell
      title="YouTube Analytics"
      description="Track performance of selected YouTube videos and channels."
    >
      {currentUser?.role === 'admin' && (
        <div className="mb-6 flex items-center gap-4">
          <Label htmlFor="user-select" className="text-sm font-medium">View videos assigned to:</Label>
          {isLoadingUsers ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="user-select" className="w-[250px] bg-background shadow-sm">
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
      )}
      <GenericDataTable<YoutubeVideo>
        data={displayedVideos}
        columns={columns}
        caption="YouTube Video Performance Data"
      />
    </DataTableShell>
  );
}
