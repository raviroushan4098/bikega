"use client";

import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable, renderImageCell } from '@/components/analytics/generic-data-table';
import { useAuth } from '@/contexts/auth-context';
import { getFilteredData, mockYoutubeVideos } from '@/lib/mock-data';
import type { ColumnConfig, YoutubeVideo } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns'; // Example for formatting, not used in current mock data

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
  const { user } = useAuth();
  const youtubeData = getFilteredData(mockYoutubeVideos, user);

  return (
    <DataTableShell
      title="YouTube Analytics"
      description="Track performance of selected YouTube videos and channels."
    >
      <GenericDataTable<YoutubeVideo>
        data={youtubeData}
        columns={columns}
        caption="YouTube Video Performance Data"
      />
    </DataTableShell>
  );
}
