
"use client";

import React from 'react';
import type { YouTubeMentionItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertTriangle, ExternalLink, Rss, SearchX, Eye, ThumbsUp, MessageSquare, SmilePlus, Frown, MinusCircle } from 'lucide-react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface YouTubeMentionsCardProps {
  mentions: YouTubeMentionItem[];
  isLoading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  title: string;
  keywordsUsed?: string[];
}

const StatDisplay: React.FC<{ icon: React.ElementType; value?: number; label: string }> = ({ icon: Icon, value, label }) => (
  <div className="flex items-center text-xs text-muted-foreground/90" title={label}>
    <Icon className="h-3.5 w-3.5 mr-1" />
    <span>{value?.toLocaleString() ?? '0'}</span>
  </div>
);

const SentimentBadge: React.FC<{ sentiment?: YouTubeMentionItem['sentiment'] }> = ({ sentiment }) => {
  let Icon = MinusCircle;
  let text = "Unknown";
  let badgeVariant: "default" | "destructive" | "secondary" | "outline" = "outline";

  switch (sentiment) {
    case 'positive':
      Icon = SmilePlus;
      text = "Positive";
      badgeVariant = "default";
      break;
    case 'negative':
      Icon = Frown;
      text = "Negative";
      badgeVariant = "destructive";
      break;
    case 'neutral':
      Icon = MinusCircle; // Or another neutral icon
      text = "Neutral";
      badgeVariant = "secondary";
      break;
  }

  return (
    <Badge variant={badgeVariant} className="flex items-center gap-1 text-xs px-1.5 py-0.5">
      <Icon className="h-3 w-3" />
      {text}
    </Badge>
  );
};


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
      <CardHeader className="flex flex-row items-start sm:items-center justify-between pb-3 gap-2">
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
          <ScrollArea className="h-[400px] pr-3">
            <div className="space-y-4">
              {mentions.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 border rounded-md hover:bg-accent/50 transition-colors">
                  <Link href={item.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    <Image
                      src={item.thumbnailUrl || "https://placehold.co/120x68.png"}
                      alt={`Thumbnail for ${item.title}`}
                      width={120}
                      height={68} 
                      className="rounded-md object-cover aspect-video"
                      data-ai-hint={item.dataAiHint || "video content"}
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      <h3 className="text-sm font-semibold text-card-foreground line-clamp-2">{item.title}</h3>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.channelTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}
                    </p>
                     {item.descriptionSnippet && (
                         <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1 italic">"{item.descriptionSnippet}"</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StatDisplay icon={Eye} value={item.viewCount} label="Views" />
                      <StatDisplay icon={ThumbsUp} value={item.likeCount} label="Likes" />
                      <StatDisplay icon={MessageSquare} value={item.commentCount} label="Comments" />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex flex-wrap gap-1">
                        {item.matchedKeywords.map((kw, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0.5">{kw}</Badge>
                        ))}
                      </div>
                      <SentimentBadge sentiment={item.sentiment} />
                    </div>
                  </div>
                   <Link href={item.url} target="_blank" rel="noopener noreferrer" legacyBehavior>
                      <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto self-start shrink-0" title="Watch on YouTube">
                        <ExternalLink className="h-4 w-4 text-primary" />
                      </Button>
                    </Link>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default YouTubeMentionsCard;

