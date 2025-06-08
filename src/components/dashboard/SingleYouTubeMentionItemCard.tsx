
"use client";

import React from 'react';
import type { YouTubeMentionItem } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Eye, ThumbsUp, MessageSquare, Youtube, PlayCircle, SmilePlus, Smile, Frown, HelpCircle, ExternalLink } from 'lucide-react';
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

const SentimentDisplayBadge: React.FC<{ sentiment?: YouTubeMentionItem['sentiment'] }> = ({ sentiment }) => {
  let IconComponent: React.ElementType = HelpCircle;
  let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary"; // Default to secondary for white/light bg
  let text = "Unknown";
  let iconColor = "text-gray-500"; 

  switch (sentiment) {
    case 'positive':
      IconComponent = SmilePlus;
      badgeVariant = "secondary"; // Keep background white/light gray
      text = "Positive";
      iconColor = "text-green-500";
      break;
    case 'neutral':
      IconComponent = Smile;
      badgeVariant = "secondary";
      text = "Neutral";
      iconColor = "text-yellow-600"; // Adjusted for better visibility on light bg
      break;
    case 'negative':
      IconComponent = Frown;
      badgeVariant = "destructive";
      text = "Negative";
      iconColor = "text-destructive-foreground"; // Icon color for destructive badge
      break;
    case 'unknown':
    default:
      IconComponent = HelpCircle;
      badgeVariant = "outline"; // Use outline for unknown to make it distinct
      text = "Unknown";
      iconColor = "text-muted-foreground";
      break;
  }

  return (
    <Badge variant={badgeVariant} className="flex items-center gap-1 text-xs px-2 py-1">
      <IconComponent className={cn("h-3.5 w-3.5", iconColor)} />
      <span>{text}</span>
    </Badge>
  );
};


const SingleYouTubeMentionItemCard: React.FC<SingleYouTubeMentionItemCardProps> = ({ mention }) => {
  return (
    <Card className={cn(
      "shadow-md flex flex-col overflow-hidden h-full bg-card border border-border rounded-lg",
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
            fill 
            style={{ objectFit: 'cover' }} 
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

      <CardFooter className="p-0 relative mt-auto flex flex-col border-t border-border/50">
        <div className="w-full flex justify-between items-center pl-3 pr-20 py-2"> {/* Reduced pr-24 to pr-20 */}
          <div className="flex items-center gap-3">
            <StatDisplay icon={ThumbsUp} value={mention.likeCount} label="Likes" iconClassName="text-blue-500" textClassName="text-muted-foreground"/>
            <StatDisplay icon={MessageSquare} value={mention.commentCount} label="Comments" iconClassName="text-gray-700 dark:text-gray-300" textClassName="text-muted-foreground"/>
          </div>
          <div className="flex items-center">
            <SentimentDisplayBadge sentiment={mention.sentiment} />
          </div>
        </div>
        
        <div 
          className="absolute bottom-0 right-0 h-12 w-16 bg-red-600 flex items-center justify-center"
          style={{
            clipPath: 'polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%)',
          }}
          title="Watch on YouTube"
        >
          <Link href={mention.url} target="_blank" rel="noopener noreferrer" className="block p-1 -mr-1 -mb-0.5">
             <Youtube className="h-5 w-5 text-white" />
          </Link>
        </div>
        
        {mention.matchedKeywords && mention.matchedKeywords.length > 0 && (
          <div className="w-full bg-muted/40 px-3 py-1.5 border-t border-border/30">
            <div className="flex items-center gap-1 flex-wrap">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                Matched:
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
