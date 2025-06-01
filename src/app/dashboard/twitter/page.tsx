"use client";

import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable, renderImageCell } from '@/components/analytics/generic-data-table';
import { useAuth } from '@/contexts/auth-context';
import { getFilteredData, mockTweets } from '@/lib/mock-data';
import type { ColumnConfig, Tweet } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Repeat, Heart } from 'lucide-react';

const columns: ColumnConfig<Tweet>[] = [
  { 
    key: 'authorAvatarUrl', 
    header: 'Author', 
    render: (item) => (
      <div className="flex items-center gap-2">
        {renderImageCell(item, 'avatar')}
        <span className="font-medium">{item.author}</span>
      </div>
    ),
    className: "w-[180px]"
  },
  { key: 'text', header: 'Tweet Text', sortable: true, className: "min-w-[300px]" },
  { 
    key: 'timestamp', 
    header: 'Timestamp', 
    sortable: true, 
    render: (item) => formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }),
    className: "w-[180px]"
  },
  { 
    key: 'commentsOrRepliesCount', 
    header: 'Replies', 
    sortable: true, 
    render: (item) => (
        <div className="flex items-center justify-end gap-1">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground"/>
            {item.commentsOrRepliesCount.toLocaleString()}
        </div>
    ),
    className: "text-right w-[100px]"
  },
  { 
    key: 'retweetCount', 
    header: 'Retweets', 
    sortable: true, 
    render: (item) => (
        <div className="flex items-center justify-end gap-1">
            <Repeat className="h-3.5 w-3.5 text-muted-foreground"/>
            {item.retweetCount.toLocaleString()}
        </div>
    ),
    className: "text-right w-[100px]"
  },
  { 
    key: 'likeCount', 
    header: 'Likes', 
    sortable: true, 
    render: (item) => (
        <div className="flex items-center justify-end gap-1">
            <Heart className="h-3.5 w-3.5 text-muted-foreground"/>
            {item.likeCount.toLocaleString()}
        </div>
    ),
    className: "text-right w-[100px]"
  },
];

export default function TwitterAnalyticsPage() {
  const { user } = useAuth();
  const twitterData = getFilteredData(mockTweets, user);

  return (
    <DataTableShell
      title="Twitter / X Analytics"
      description="Track tweets, comments, and replies based on your keywords."
    >
      <GenericDataTable<Tweet>
        data={twitterData}
        columns={columns}
        caption="Twitter/X Activity Data"
      />
    </DataTableShell>
  );
}
