"use client";

import React from 'react';
import type { Mention } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ExternalLink, Globe, MessageSquare, Rss, Smile, TrendingDown, TrendingUp, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { parseRssXmlEntry } from '@/lib/xml-parser';

interface GlobalMentionCardProps {
  mention: {
    id: string;
    xmlContent: string;
    createdAt: Date;
  };
}

const PlatformIcon: React.FC<{ platform: Mention['platform'] }> = ({ platform }) => {
  switch (platform) {
    case 'Hacker News':
      return <UserCircle className="h-4 w-4 text-orange-500" />;
    case 'Google News': // Covers GNews API results
      return <Globe className="h-4 w-4 text-blue-500" />;
    case 'RSS Feed':
      return <Rss className="h-4 w-4 text-amber-600" />;
    case 'Twitter/X':
      return <MessageSquare className="h-4 w-4 text-sky-500" />; // Example, update if using actual Twitter icon
    default:
      return <Globe className="h-4 w-4 text-gray-500" />;
  }
};

const renderSentimentBadge = (sentiment?: Mention['sentiment']) => {
  let badgeVariant: "default" | "destructive" | "secondary" | "outline" = "outline";
  let text = "N/A";
  let IconComponent: React.ElementType | null = null;

  switch (sentiment) {
    case 'positive':
      badgeVariant = "default"; 
      text = "Positive";
      IconComponent = TrendingUp;
      break;
    case 'negative':
      badgeVariant = "destructive";
      text = "Negative";
      IconComponent = TrendingDown;
      break;
    case 'neutral':
      badgeVariant = "secondary";
      text = "Neutral";
      IconComponent = Smile; // Changed from Minus
      break;
    default: 
      badgeVariant = "outline";
      text = "Unknown";
      break;
  }
  return (
    <Badge variant={badgeVariant} className="flex items-center gap-1 text-xs px-2 py-0.5">
      {IconComponent && <IconComponent className="h-3 w-3" />}
      {text}
    </Badge>
  );
};

export default function GlobalMentionCard({ mention }: GlobalMentionCardProps) {
  const parsedEntry = parseRssXmlEntry(mention.xmlContent);
  
  if (!parsedEntry) return null;

  const decodedTitle = new DOMParser().parseFromString(parsedEntry.title, 'text/html').body.textContent;
  const decodedContent = new DOMParser().parseFromString(parsedEntry.content, 'text/html').body.textContent;

  let displayTimestamp = "Invalid Date";
  try {
    const parsedDate = parseISO(mention.timestamp);
    displayTimestamp = formatDistanceToNow(parsedDate, { addSuffix: true });
  } catch (e) {
    console.warn("Error parsing timestamp for mention:", mention.id, mention.timestamp);
  }

  return (
    <Card className="shadow-md hover:shadow-xl transition-shadow duration-300 ease-in-out hover:scale-[1.01] flex flex-col h-full border border-border overflow-hidden rounded-lg bg-card">
      <CardHeader className="p-4 pb-2 space-y-1.5">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs px-2 py-0.5 flex items-center gap-1">
              <PlatformIcon platform={mention.platform} /> 
              {mention.platform}
            </Badge>
            {mention.source && mention.source !== mention.platform && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 truncate max-w-[150px]" title={mention.source}>
                    {mention.source}
                </Badge>
            )}
          </div>
        </div>
        
        <CardTitle className="text-base font-semibold leading-snug line-clamp-2 pt-1 hover:text-primary transition-colors">
          <Link href={mention.url} target="_blank" rel="noopener noreferrer">
            {mention.title || "Untitled Mention"}
          </Link>
        </CardTitle>

        <CardDescription className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
          <span>{displayTimestamp}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 pt-1 flex-grow space-y-2 min-h-[60px]">
        <p className="text-sm text-card-foreground/90 line-clamp-3">
          {mention.excerpt || "No excerpt available."}
        </p>
        {mention.matchedKeyword && (
          <div className="pt-1">
            <Badge variant="outline" className="text-xs px-1.5 py-0.5 border-primary/50 text-primary bg-primary/10">
              Keyword: {mention.matchedKeyword}
            </Badge>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-2 mt-auto flex justify-between items-center border-t border-border/50">
        {renderSentimentBadge(mention.sentiment)}
        <Link href={mention.url} target="_blank" rel="noopener noreferrer" title="View Original Source" className="text-muted-foreground hover:text-primary transition-colors">
          <ExternalLink className="h-4 w-4" />
        </Link>
      </CardFooter>
    </Card>
  );
};
