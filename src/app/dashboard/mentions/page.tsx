
"use client";

import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import { useAuth } from '@/contexts/auth-context';
import { getFilteredData, mockMentions } from '@/lib/mock-data';
import type { ColumnConfig, Mention } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
// Removed: TrendingUp, TrendingDown, MinusCircle from lucide-react

// Removed SentimentIcon component as it's no longer used

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
    render: (item) => {
      if (!item.sentiment) {
        return <Badge variant="outline">N/A</Badge>;
      }
      
      let badgeVariant: "default" | "destructive" | "secondary" = "secondary";
      let customClassName = "";

      switch (item.sentiment) {
        case 'positive':
          badgeVariant = "default"; // Using default primary for positive
          customClassName = "bg-green-500/20 text-green-700 border-green-300 hover:bg-green-500/30"; // More specific green
          break;
        case 'negative':
          badgeVariant = "destructive"; // Destructive variant for negative
          // customClassName = "bg-red-500/20 text-red-700 border-red-300 hover:bg-red-500/30"; // Default destructive is usually good
          break;
        case 'neutral':
          badgeVariant = "secondary"; // Secondary variant for neutral
          break;
        default:
          badgeVariant = "outline";
          break;
      }

      return (
        <Badge variant={badgeVariant} className={customClassName}>
          {item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1)}
        </Badge>
      );
    },
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
