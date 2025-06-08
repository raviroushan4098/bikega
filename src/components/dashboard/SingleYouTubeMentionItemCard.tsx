
"use client";

import React from 'react';
import type { YouTubeMentionItem } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Eye, ThumbsUp, MessageSquare, Youtube, PlayCircle, SmilePlus, Smile, Frown, AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SingleYouTubeMentionItemCardProps {
  mention: YouTubeMentionItem;
}

const StatDisplay: React.FC<{ icon: React.ElementType; value?: number; label: string; iconClassName?: string; textClassName?: string }> = ({ icon: Icon, value, label, iconClassName, textClassName }) => (
  <div className="flex items-center" title={label}>
    <Icon className={cn("h-5 w-5 mr-1", iconClassName)} />
    <span className={cn("text-sm", textClassName)}>{value?.toLocaleString() ?? '0'}</span>
  </div>
);

const SentimentIcon: React.FC<{ sentiment?: YouTubeMentionItem['sentiment'] }> = ({ sentiment }) => {
  switch (sentiment) {
    case 'positive':
      return <SmilePlus className="h-6 w-6 text-green-500" title="Positive Sentiment"/>;
    case 'neutral':
      return <Smile className="h-6 w-6 text-yellow-500" title="Neutral Sentiment"/>;
    case 'negative':
      return <Frown className="h-6 w-6 text-red-500" title="Negative Sentiment"/>;
    case 'unknown':
    default:
      return <HelpCircle className="h-6 w-6 text-gray-400" title="Sentiment Unknown"/>;
  }
};

const SingleYouTubeMentionItemCard: React.FC<SingleYouTubeMentionItemCardProps> = ({ mention }) => {
  return (
    <Card className={cn(
      "shadow-md flex flex-col overflow-hidden h-full bg-card border border-border rounded-lg", // Added rounded-lg
      "transition-all duration-300 ease-in-out hover:shadow-xl hover:scale-[1.02]"
    )}>
      <CardHeader className="p-3 pb-2 space-y-1">
        <Link href={mention.url} target="_blank" rel="noopener noreferrer" className="block group">
          <CardTitle className="text-sm font-semibold text-card-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors" title={mention.title}>
            {mention.title}
          </CardTitle>
        </Link>
        <p className="text-xs text-muted-foreground truncate" title={mention.channelTitle}>
          By: <span className="font-medium text-card-foreground/90">{mention.channelTitle}</span>
        </p>
      </CardHeader>

      <div className="p-3 pt-0 relative group aspect-video">
        <Link href={mention.url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
          <Image
            src={mention.thumbnailUrl || "https://placehold.co/480x270.png"}
            alt={`Thumbnail for ${mention.title}`}
            layout="fill"
            objectFit="cover"
            className="rounded-md transition-transform duration-300 group-hover:scale-105"
            data-ai-hint={mention.dataAiHint || "video content"}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors duration-300 rounded-md">
            <PlayCircle className="h-12 w-12 text-white/70 group-hover:text-white transition-all duration-300 group-hover:scale-110" />
          </div>
        </Link>
      </div>
      
      <CardContent className="p-3 pt-2 flex-grow space-y-1.5">
        <p className="text-xs text-muted-foreground">
          Published: {formatDistanceToNow(new Date(mention.publishedAt), { addSuffix: true })}
        </p>
        <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center"><Eye className="h-3.5 w-3.5 mr-1"/>{mention.viewCount?.toLocaleString() ?? '0'} views</div>
        </div>
      </CardContent>

      {/* New Footer Implementation */}
      <CardFooter className="p-0 relative mt-auto flex flex-col border-t border-border/50">
        {/* Top row of footer: Stats and Sentiment */}
        <div className="w-full flex justify-between items-center px-3 py-2">
          <div className="flex items-center gap-3">
            <StatDisplay icon={ThumbsUp} value={mention.likeCount} label="Likes" iconClassName="text-blue-500" textClassName="text-muted-foreground"/>
            <StatDisplay icon={MessageSquare} value={mention.commentCount} label="Comments" iconClassName="text-gray-700 dark:text-gray-300" textClassName="text-muted-foreground"/>
          </div>
          <div className="flex items-center gap-2">
            {/* Placeholder for the second sentiment icon if needed in future, matching image style */}
            {/* <Smile className="h-6 w-6 text-yellow-400" />  */}
            <SentimentIcon sentiment={mention.sentiment} />
          </div>
        </div>

        {/* Red diagonal corner with YouTube icon - This is a simplified version */}
        <div 
          className="absolute bottom-0 right-0 h-16 w-20 bg-red-600 flex items-center justify-center"
          style={{
            clipPath: 'polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%)', // Creates a slanted right edge
          }}
          title="Watch on YouTube"
        >
          <Link href={mention.url} target="_blank" rel="noopener noreferrer" className="block p-2 -mr-2 -mb-1">
             <Youtube className="h-6 w-6 text-white" />
          </Link>
        </div>
        
        {/* Keywords strip at the very bottom */}
        {mention.matchedKeywords.length > 0 && (
          <div className="w-full bg-muted/40 px-3 py-1.5 border-t border-border/30">
            <div className="flex items-center gap-1 flex-wrap">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {mention.matchedKeywords[0]}:
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-normal text-muted-foreground truncate flex-1 min-w-0">
                {mention.matchedKeywords.slice(0, 3).join(', ')}
                {mention.matchedKeywords.length > 3 ? ` +${mention.matchedKeywords.length - 3} more` : ''}
              </Badge>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default SingleYouTubeMentionItemCard;

