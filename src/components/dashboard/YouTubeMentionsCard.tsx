
"use client";

import React, { useMemo } from 'react'; // Added useMemo
import type { YouTubeMentionItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; 
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Rss, SearchX, SmilePlus, Frown, MinusCircle, AlertCircle, ExternalLink, ThumbsUp, MessageSquare, Eye } from 'lucide-react'; 
import { cn } from '@/lib/utils';
import SingleYouTubeMentionItemCard from './SingleYouTubeMentionItemCard'; 
import { Badge } from '@/components/ui/badge'; 
import { format, parseISO } from 'date-fns'; // Import for formatting

interface YouTubeMentionsCardProps {
  mentions: YouTubeMentionItem[];
  isLoading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  title: string;
  keywordsUsed?: string[];
  lastRefreshTimestamp?: string | null;
}

interface GroupedMentions {
  [dateKey: string]: YouTubeMentionItem[];
}

const YouTubeMentionsCard: React.FC<YouTubeMentionsCardProps> = ({
  mentions,
  isLoading,
  error,
  onRefresh,
  title,
  keywordsUsed,
  lastRefreshTimestamp
}) => {

  const groupedMentions = useMemo(() => {
    if (!mentions || mentions.length === 0) return {};
    
    return mentions.reduce((acc, mention) => {
      try {
        // Format: "Saturday, June 7, 2025"
        const dateKey = format(parseISO(mention.publishedAt), 'EEEE, MMMM d, yyyy');
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(mention);
      } catch (e) {
        console.error("Error parsing date for mention:", mention.id, mention.publishedAt, e);
        // Fallback group if date is invalid
        const fallbackKey = "Undated Mentions";
         if (!acc[fallbackKey]) {
          acc[fallbackKey] = [];
        }
        acc[fallbackKey].push(mention);
      }
      return acc;
    }, {} as GroupedMentions);
  }, [mentions]);

  // Since the original mentions array is sorted newest first, Object.keys will likely give dates in a usable order.
  // For guaranteed order, one might sort the keys if needed, but usually, it's fine.
  const sortedDateKeys = useMemo(() => {
    return Object.keys(groupedMentions).sort((a, b) => {
      // Handle "Undated Mentions" case by pushing it to the end or beginning
      if (a === "Undated Mentions") return 1;
      if (b === "Undated Mentions") return -1;
      // Attempt to parse dates for robust sorting, assuming format 'EEEE, MMMM d, yyyy'
      // This might be complex due to format variations; for simplicity, rely on source sort if possible
      // or use a more straightforward date key for sorting if performance is an issue.
      // For now, as mentions are presorted, the Object.keys order should be mostly correct (newest date groups first)
      // if parseISO was used consistently in grouping, or use timestamp from first item in group.
      const dateA = groupedMentions[a][0] ? parseISO(groupedMentions[a][0].publishedAt).getTime() : 0;
      const dateB = groupedMentions[b][0] ? parseISO(groupedMentions[b][0].publishedAt).getTime() : 0;
      return dateB - dateA; // Sort date groups descending (newest first)
    });
  }, [groupedMentions]);


  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-start sm:items-center justify-between pb-4 gap-2">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-lg font-headline flex items-center">
            <Rss className="mr-2 h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          {keywordsUsed && keywordsUsed.length > 0 && !isLoading && !error && (
             <div className="text-xs text-muted-foreground mt-1">
                Displaying mentions for:
                {keywordsUsed.map((kw, i) => (
                  <Badge key={i} variant="outline" className="mr-1 ml-1 text-xs">
                    {kw}
                  </Badge>
                ))}
            </div>
          )}
           {lastRefreshTimestamp && !isLoading && !error && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Last refreshed: {formatDistanceToNow(new Date(lastRefreshTimestamp), { addSuffix: true })}
            </div>
           )}
           {keywordsUsed && keywordsUsed.length === 0 && !isLoading && !error && (
            <div className="text-xs text-muted-foreground mt-1">No keywords configured to search for mentions.</div>
          )}
        </div>
        {onRefresh && (
          <Button onClick={onRefresh} variant="outline" size="sm" disabled={isLoading} className="mt-1 sm:mt-0">
            <Loader2 className={cn("mr-2 h-4 w-4", isLoading ? "animate-spin" : "hidden")} />
            Refresh Mentions
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p>Loading YouTube mentions...</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-10 text-destructive-foreground bg-destructive/10 p-4 rounded-md border border-destructive/30">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <p className="font-semibold">Error Fetching Mentions</p>
            <p className="text-sm text-center">{error}</p>
          </div>
        )}
        {!isLoading && !error && mentions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <SearchX className="h-10 w-10 text-primary mb-3" />
            <p className="font-semibold">No Mentions Found</p>
            <p className="text-sm text-center">
              {keywordsUsed && keywordsUsed.length > 0 ? 
                `No YouTube videos found matching your keywords: "${keywordsUsed.join('", "')}" in the last 24 hours.` :
                "No keywords were provided to search for mentions."
              }
            </p>
          </div>
        )}
        {!isLoading && !error && mentions.length > 0 && (
          <div className="space-y-6">
            {sortedDateKeys.map((dateKey) => {
              const itemsForDate = groupedMentions[dateKey];
              if (!itemsForDate || itemsForDate.length === 0) return null;
              return (
                <div key={dateKey}>
                  <h2 className="text-xl font-semibold mb-3 text-primary">
                    {dateKey} - <span className="font-medium">{itemsForDate.length} Result{itemsForDate.length === 1 ? '' : 's'}</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {itemsForDate.map((item) => (
                      <SingleYouTubeMentionItemCard key={item.id} mention={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default YouTubeMentionsCard;
