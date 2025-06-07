
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import { useAuth } from '@/contexts/auth-context';
import { getGlobalMentionsForUser } from '@/lib/global-mentions-service'; // Updated service
import { gatherGlobalMentions, GatherGlobalMentionsOutput } from '@/ai/flows/gather-global-mentions-flow'; // Genkit flow
import type { ColumnConfig, Mention } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCw, ExternalLink, Globe, MessageSquareText, Rss, Twitter as TwitterIcon, Info, Link as LinkIcon } from 'lucide-react'; // Added Info, LinkIcon
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert components
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Added Tooltip

const PlatformIcon: React.FC<{ platform: Mention['platform'] }> = ({ platform }) => {
  switch (platform) {
    case 'Reddit': // Kept for potential old data, but new flow won't fetch for Global Mentions
      return <MessageSquareText className="h-4 w-4 text-orange-500" />;
    case 'Hacker News':
      return <Rss className="h-4 w-4 text-red-600" />;
    case 'Twitter/X': // Kept for potential old data, but new flow won't fetch for Global Mentions
      return <TwitterIcon className="h-4 w-4 text-blue-500" />;
    case 'Google News':
      return <Globe className="h-4 w-4 text-green-500" />;
    case 'Web Mention':
      return <LinkIcon className="h-4 w-4 text-purple-500" />;
    default:
      return <Globe className="h-4 w-4 text-muted-foreground" />;
  }
};


const columns: ColumnConfig<Mention>[] = [
  {
    key: 'platform',
    header: 'Platform',
    render: (item) => (
      <div className="flex items-center gap-2">
        <PlatformIcon platform={item.platform} />
        <span className="font-medium">{item.platform}</span>
      </div>
    ),
    className: "w-[180px]"
  },
  {
    key: 'title',
    header: 'Title / Source',
    render: (item) => (
      <div>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline line-clamp-2">
          {item.title}
        </a>
        <p className="text-xs text-muted-foreground mt-0.5">{item.source}</p>
      </div>
    ),
    sortable: true,
    className: "min-w-[250px]"
  },
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
      if (!item.sentiment || item.sentiment === 'unknown') {
        return <Badge variant="outline">N/A</Badge>;
      }

      let badgeVariant: "default" | "destructive" | "secondary" = "secondary";
      switch (item.sentiment) {
        case 'positive': badgeVariant = "default"; break;
        case 'negative': badgeVariant = "destructive"; break;
        case 'neutral': badgeVariant = "secondary"; break;
      }
      return (
        <Badge variant={badgeVariant}>
          {item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1)}
        </Badge>
      );
    },
    className: "w-[120px]"
  },
  {
    key: 'matchedKeyword',
    header: 'Keyword',
    render: (item) => <Badge variant="outline">{item.matchedKeyword}</Badge>,
    className: "w-[150px]",
  },
  {
    key: 'actions',
    header: 'Link',
    render: (item) => (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Open mention: ${item.title}`}>
                <ExternalLink className="h-4 w-4 text-primary" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>View Original</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
    className: "text-center w-[80px]",
  }
];

export default function MentionsAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [mentionsData, setMentionsData] = useState<Mention[]>([]);
  const [isLoadingMentions, setIsLoadingMentions] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchMentions = useCallback(async () => {
    if (!user || !user.id) {
      console.log('[MentionsPage] fetchMentions: No user or user.id, clearing data.');
      setMentionsData([]);
      setIsLoadingMentions(false);
      return;
    }
    console.log(`[MentionsPage] fetchMentions: Fetching data for user ID: ${user.id}, Name: ${user.name}`);
    setIsLoadingMentions(true);
    try {
      const fetchedMentions = await getGlobalMentionsForUser(user.id);
      setMentionsData(fetchedMentions);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch global mentions." });
      setMentionsData([]);
    } finally {
      setIsLoadingMentions(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading) { // Only fetch if auth state is resolved
      fetchMentions();
    }
  }, [user, authLoading, fetchMentions]);

  const handleRefreshMentions = async () => {
    if (!user || !user.id || !user.assignedKeywords || user.assignedKeywords.length === 0) {
      toast({ variant: "destructive", title: "Cannot Refresh", description: "No keywords assigned or not logged in." });
      return;
    }
    setIsRefreshing(true);
    toast({ title: "Refreshing Global Mentions...", description: "Fetching latest mentions from news, blogs, forums, and websites. This may take a few moments." });
    try {
      const result: GatherGlobalMentionsOutput = await gatherGlobalMentions({ userId: user.id });

      let description = `Fetched ${result.totalMentionsFetched} potential items from APIs. ${result.newMentionsStored} items created/updated in database.`;
      if(result.errors && result.errors.length > 0) {
        description += ` Encountered ${result.errors.length} errors/issues during processing. Check console for details.`;
        console.error("Errors/Issues during global mention refresh:", result.errors);
      }
      toast({ title: "Refresh Complete", description, duration: 7000 });
      await fetchMentions(); // Re-fetch to update the table
    } catch (error) {
      console.error("Error calling gatherGlobalMentions flow:", error);
      toast({ variant: "destructive", title: "Refresh Error", description: "An unexpected error occurred during refresh." });
    } finally {
      setIsRefreshing(false);
    }
  };

  const noKeywordsAssigned = !authLoading && user && (!user.assignedKeywords || user.assignedKeywords.length === 0);

  return (
    <DataTableShell
      title="Global Mentions Tracker"
      description="Monitor mentions of your keywords across news, blogs, forums, and general webpages."
    >
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <Alert variant="default" className="w-full sm:w-auto sm:max-w-md bg-primary/10 border-primary/30">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary font-semibold">Focus Area</AlertTitle>
            <AlertDescription className="text-primary/80 text-xs">
            This tracker focuses on Hacker News (live), and includes mock data for Google News (news channels), and general Web Mentions (blogs, forums, webpages). More live sources coming soon! Refresh may take time.
            </AlertDescription>
        </Alert>
        <Button onClick={handleRefreshMentions} disabled={isRefreshing || isLoadingMentions || noKeywordsAssigned} className="w-full sm:w-auto">
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Mentions'}
        </Button>
      </div>

      {noKeywordsAssigned && (
        <div className="text-center py-10 text-muted-foreground bg-card p-6 rounded-lg shadow">
          <Globe className="mx-auto h-12 w-12 mb-3" />
          <p className="text-lg font-semibold">No Keywords to Track</p>
          <p>Please assign keywords to your profile via an administrator to use the Global Mentions Tracker.</p>
        </div>
      )}

      {!noKeywordsAssigned && (
        <GenericDataTable<Mention>
          data={mentionsData}
          columns={columns}
          caption={isLoadingMentions ? "Loading global mentions..." : "Global Mentions Data"}
        />
      )}
    </DataTableShell>
  );
}

