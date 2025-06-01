"use client";

import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import { useAuth } from '@/contexts/auth-context';
import { getFilteredData, mockMentions } from '@/lib/mock-data';
import type { ColumnConfig, Mention } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { TrendingUp, TrendingDown, MinusCircle } from 'lucide-react';

const SentimentIcon = ({ sentiment }: { sentiment?: 'positive' | 'neutral' | 'negative' }) => {
  if (sentiment === 'positive') return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (sentiment === 'negative') return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
};


const columns: ColumnConfig<Mention>[] = [
  { key: 'source', header: 'Source', sortable: true, className: "w-[180px] font-medium" },
  { key: 'title', header: 'Title', sortable: true, className: "min-w-[250px]" },
  { 
    key: 'excerpt', 
    header: 'Excerpt', 
    render: (item) => <p className="text-sm text-muted-foreground line-clamp-2">{item.excerpt}</p>,
    className: "min-w-[300px] max-w-md"
  },
  { 
    key: 'timestamp', 
    header: 'Date', 
    sortable: true, 
    render: (item) => formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }),
    className: "w-[180px]"
  },
  { 
    key: 'sentiment', 
    header: 'Sentiment', 
    render: (item) => (
      <div className="flex items-center gap-2">
        <SentimentIcon sentiment={item.sentiment} />
        {item.sentiment ? <Badge variant={
            item.sentiment === 'positive' ? 'default' : item.sentiment === 'negative' ? 'destructive' : 'secondary'
          } className={
            item.sentiment === 'positive' ? 'bg-green-500/20 text-green-700' : 
            item.sentiment === 'negative' ? 'bg-red-500/20 text-red-700' : ''
          }>
            {item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1)}
          </Badge> 
        : <Badge variant="outline">N/A</Badge>}
      </div>
    ),
    className: "w-[150px]"
  },
];

export default function MentionsAnalyticsPage() {
  const { user } = useAuth();
  const mentionsData = getFilteredData(mockMentions, user);

  return (
    <DataTableShell
      title="Global Mentions Tracker"
      description="Monitor mentions of your keywords across news outlets, blogs, forums, and other websites."
    >
      <GenericDataTable<Mention>
        data={mentionsData}
        columns={columns}
        caption="Global Mentions Data"
      />
    </DataTableShell>
  );
}
