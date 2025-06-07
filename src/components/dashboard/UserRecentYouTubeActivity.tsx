
"use client";

import React from 'react';
import { Youtube, Loader2, AlertTriangle, ExternalLink, SearchX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { YouTubeMentionItem } from '@/types';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

interface UserRecentYouTubeActivityProps {
  mentions: YouTubeMentionItem[];
  isLoading: boolean;
  error?: string | null;
  keywordsUsed?: string[];
}

const UserRecentYouTubeActivity: React.FC<UserRecentYouTubeActivityProps> = ({
  mentions,
  isLoading,
  error,
  keywordsUsed,
}) => {
  const displayMentions = mentions.slice(0, 4); // Show top 4 recent mentions

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center">
          <Youtube className="w-5 h-5 text-destructive mr-2" />
          Recent YouTube Mentions
        </CardTitle>
        {keywordsUsed && keywordsUsed.length > 0 && !isLoading && !error && (
          <CardDescription className="text-xs">
            Showing latest videos matching: {keywordsUsed.slice(0,3).map(kw => `"${kw}"`).join(', ')}
            {keywordsUsed.length > 3 ? '...' : ''}
          </CardDescription>
        )}
         {keywordsUsed && keywordsUsed.length === 0 && !isLoading && !error && (
          <CardDescription className="text-xs">No keywords configured to find mentions.</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-grow">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm">Loading recent mentions...</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-destructive-foreground bg-destructive/10 p-4 rounded-md border border-destructive/30">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <p className="font-semibold text-sm">Error Fetching Mentions</p>
            <p className="text-xs text-center">{error}</p>
          </div>
        )}
        {!isLoading && !error && displayMentions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <SearchX className="h-10 w-10 text-primary mb-3" />
            <p className="font-semibold text-sm">No Recent Mentions Found</p>
            <p className="text-xs text-center">
              {keywordsUsed && keywordsUsed.length > 0 ? 
                `No YouTube videos found matching your keywords in the last 24 hours.` :
                "No keywords are assigned to search for mentions."
              }
            </p>
          </div>
        )}
        {!isLoading && !error && displayMentions.length > 0 && (
          <div className="space-y-3">
            {displayMentions.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-2 border-b border-border/50 last:border-b-0 hover:bg-accent/30 rounded-sm transition-colors">
                 <Link href={item.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    <Image
                      src={item.thumbnailUrl || "https://placehold.co/80x45.png"}
                      alt={`Thumbnail for ${item.title}`}
                      width={80}
                      height={45}
                      className="rounded-sm object-cover aspect-video"
                      data-ai-hint={item.dataAiHint || "video content"}
                    />
                  </Link>
                <div className="flex-1 min-w-0">
                  <Link href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    <h4 className="text-xs font-medium text-card-foreground line-clamp-2 leading-snug">{item.title}</h4>
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">{item.channelTitle}</p>
                  <p className="text-xs text-muted-foreground/80">
                    {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}
                  </p>
                  {item.matchedKeywords.length > 0 && (
                     <Badge variant="secondary" className="text-[10px] px-1 py-0 mt-0.5">{item.matchedKeywords[0]}</Badge>
                  )}
                </div>
                <Link href={item.url} target="_blank" rel="noopener noreferrer" legacyBehavior>
                  <Button variant="ghost" size="icon" className="h-6 w-6 self-center shrink-0" title="Watch on YouTube">
                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                  </Button>
                </Link>
              </div>
            ))}
             {mentions.length > 4 && (
              <div className="text-center mt-3">
                <Link href="/dashboard/youtube" passHref>
                  <Button variant="link" size="sm" className="text-xs">
                    View all {mentions.length} mentions &rarr;
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserRecentYouTubeActivity;
