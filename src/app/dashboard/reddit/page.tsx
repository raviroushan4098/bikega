"use client";

import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import { useAuth } from '@/contexts/auth-context';
import { getFilteredData, mockRedditPosts } from '@/lib/mock-data';
import type { ColumnConfig, RedditPost } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

const columns: ColumnConfig<RedditPost>[] = [
  { key: 'title', header: 'Post Title', sortable: true, className: "min-w-[250px] font-medium" },
  { key: 'subreddit', header: 'Subreddit', sortable: true, className: "w-[150px]" },
  { key: 'author', header: 'Author', sortable: true, className: "w-[150px]" },
  { 
    key: 'timestamp', 
    header: 'Timestamp', 
    sortable: true, 
    render: (item) => formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }),
    className: "w-[180px]"
  },
  { 
    key: 'score', 
    header: 'Score', 
    sortable: true, 
    render: (item) => item.score.toLocaleString(),
    className: "text-right w-[100px]"
  },
  { 
    key: 'numComments', 
    header: 'Comments', 
    sortable: true, 
    render: (item) => item.numComments.toLocaleString(),
    className: "text-right w-[120px]"
  },
  { 
    key: 'flair', 
    header: 'Flair', 
    render: (item) => item.flair ? <Badge variant="secondary">{item.flair}</Badge> : '-',
    className: "w-[120px]"
  },
];

export default function RedditAnalyticsPage() {
  const { user } = useAuth();
  const redditData = getFilteredData(mockRedditPosts, user);

  return (
    <DataTableShell
      title="Reddit Analytics"
      description="Monitor Reddit posts based on your defined keywords."
    >
      <GenericDataTable<RedditPost>
        data={redditData}
        columns={columns}
        caption="Reddit Post Data"
      />
    </DataTableShell>
  );
}
