
"use client";

import React from 'react';
import type { YouTubeMentionItem } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Eye, ThumbsUp, MessageSquare, Youtube, PlayCircle, SmilePlus, Frown, MinusCircle, AlertCircle } from 'lucide-react'; // Added Youtube
import { cn } from '@/lib/utils';

interface SingleYouTubeMentionItemCardProps {
  mention: YouTubeMentionItem;
}

const StatDisplay: React.FC<{ icon: React.ElementType; value?: number; label: string }> = ({ icon: Icon, value, label }) => (
  <div className="flex items-center text-xs text-muted-foreground" title={label}>
    <Icon className="h-3.5 w-3.5 mr-1" />
    <span>{value?.toLocaleString() ?? '0'}</span>
  </div>
);

const SentimentDisplay: React.FC<{ sentiment?: YouTubeMentionItem['sentiment'] }> = ({ sentiment }) => {
  let Icon = MinusCircle;
  let text = "Neutral"; // Default to Neutral if unknown or not strongly positive/negative
  let iconColor = "text-gray-500";

  switch (sentiment) {
    case 'positive':
      Icon = SmilePlus;
      text = "Positive";
      iconColor = "text-green-500";
      break;
    case 'negative':
      Icon = Frown;
      text = "Negative";
      iconColor = "text-red-500";
      break;
    case 'unknown':
      Icon = AlertCircle;
      text = "Unknown";
      iconColor = "text-yellow-500";
      break;
    case 'neutral':
    default:
      Icon = MinusCircle;
      text = "Neutral";
      iconColor = "text-gray-500";
      break;
  }

  return (
    <div className="flex items-center gap-1 text-xs" title={`Sentiment: ${text}`}>
      <Icon className={cn("h-4 w-4", iconColor)} />
      <span className={cn("hidden sm:inline", iconColor)}>{text}</span>
    </div>
  );
};

const SingleYouTubeMentionItemCard: React.FC<SingleYouTubeMentionItemCardProps> = ({ mention }) => {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col overflow-hidden h-full bg-card border border-border">
      <CardHeader className="p-0 relative">
        <Link href={mention.url} target="_blank" rel="noopener noreferrer" className="block aspect-video relative group">
          <Image
            src={mention.thumbnailUrl || "https://placehold.co/480x270.png"}
            alt={`Thumbnail for ${mention.title}`}
            layout="fill"
            objectFit="cover"
            className="transition-transform duration-300 group-hover:scale-105"
            data-ai-hint={mention.dataAiHint || "video content"}
          />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <PlayCircle className="h-12 w-12 text-white/80 group-hover:text-white transition-opacity opacity-75 group-hover:opacity-100" />
          </div>
        </Link>
      </CardHeader>

      <CardContent className="p-3 flex-grow space-y-2">
        <Link href={mention.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
          <h3 className="text-sm font-semibold text-card-foreground line-clamp-2 leading-snug" title={mention.title}>
            {mention.title}
          </h3>
        </Link>
        <p className="text-xs text-muted-foreground truncate" title={mention.channelTitle}>
          By: {mention.channelTitle}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(mention.publishedAt), { addSuffix: true })}
        </p>
        
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <StatDisplay icon={Eye} value={mention.viewCount} label="Views" />
          <StatDisplay icon={ThumbsUp} value={mention.likeCount} label="Likes" />
          <StatDisplay icon={MessageSquare} value={mention.commentCount} label="Comments" />
        </div>
      </CardContent>

      <CardFooter className="p-3 border-t border-border/70 bg-muted/30 flex flex-col items-start gap-2">
        <div className="w-full flex justify-between items-center">
            <SentimentDisplay sentiment={mention.sentiment} />
            <Button variant="ghost" size="icon" asChild className="h-7 w-7 hover:bg-red-500/10">
              <a href={mention.url} target="_blank" rel="noopener noreferrer" title="Watch on YouTube">
                <Youtube className="h-5 w-5 text-red-600" />
              </a>
            </Button>
        </div>
        {mention.matchedKeywords.length > 0 && (
          <div className="w-full">
            <span className="text-xs text-muted-foreground mr-1">Keywords:</span>
            <div className="inline-flex flex-wrap gap-1">
              {mention.matchedKeywords.slice(0, 3).map((kw, idx) => ( // Show max 3 keywords
                <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                  {kw}
                </Badge>
              ))}
              {mention.matchedKeywords.length > 3 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                  +{mention.matchedKeywords.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default SingleYouTubeMentionItemCard;
