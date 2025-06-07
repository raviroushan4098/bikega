
"use client";

import React from 'react';
import type { YouTubeMentionItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Keep Card for the outer shell
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Rss, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';
import SingleYouTubeMentionItemCard from './SingleYouTubeMentionItemCard'; // Import the new card component

interface YouTubeMentionsCardProps {
  mentions: YouTubeMentionItem[];
  isLoading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  title: string;
  keywordsUsed?: string[];
}

const YouTubeMentionsCard: React.FC<YouTubeMentionsCardProps> = ({
  mentions,
  isLoading,
  error,
  onRefresh,
  title,
  keywordsUsed
}) => {
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {mentions.map((item) => (
              <SingleYouTubeMentionItemCard key={item.id} mention={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default YouTubeMentionsCard;
