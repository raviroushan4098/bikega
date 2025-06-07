
"use client";

import React from 'react';
import type { RedditPost } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpCircle, MessageSquare, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RedditItemCardProps {
  post: RedditPost;
}

const renderSentimentBadge = (sentiment?: RedditPost['sentiment']) => {
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
      IconComponent = Minus;
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

const RedditItemCard: React.FC<RedditItemCardProps> = ({ post }) => {
  const isPost = post.type === 'Post';

  return (
    <Card className="shadow-md hover:shadow-xl transition-shadow duration-300 ease-in-out hover:scale-[1.02] flex flex-col h-full border border-border overflow-hidden rounded-lg bg-card">
      <CardHeader className="p-4 pb-2 space-y-1">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs px-2 py-0.5">{post.subreddit}</Badge>
            <Badge variant={isPost ? "outline" : "default"} className="text-xs px-2 py-0.5">{post.type}</Badge>
            {post.flair && <Badge variant="outline" className="text-xs px-2 py-0.5 bg-muted/50">{post.flair}</Badge>}
          </div>
        </div>
        
        <CardTitle className="text-base font-semibold leading-tight line-clamp-2 pt-1 hover:text-primary transition-colors">
          <a href={post.url} target="_blank" rel="noopener noreferrer">
            {isPost ? post.title : `Comment on: ${post.title}`}
          </a>
        </CardTitle>

        <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
          <span>by u/{post.author}</span>
          <span className="text-muted-foreground/50">•</span>
          <span>{formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}</span>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2 flex-grow space-y-2 min-h-[60px]">
        {(post.content && post.content.trim() !== "") && (
          <p className={cn(
            "text-sm text-card-foreground/90",
             isPost ? "line-clamp-3" : "line-clamp-4" // More lines for comment content
          )}>
            {post.content}
          </p>
        )}
        {post.matchedKeyword && (
          <div className="pt-1">
            <Badge variant="outline" className="text-xs px-1.5 py-0.5 border-primary/50 text-primary bg-primary/10">
              Keyword: {post.matchedKeyword}
            </Badge>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-2 mt-auto flex justify-between items-center border-t border-border/50">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1" title="Score">
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
            <span>{post.score.toLocaleString()}</span>
          </div>
          {isPost && (
            <div className="flex items-center gap-1" title="Replies">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <span>{post.numComments.toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {renderSentimentBadge(post.sentiment)}
          <a href={post.url} target="_blank" rel="noopener noreferrer" title={`Open on Reddit`} className="text-muted-foreground hover:text-primary transition-colors">
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </CardFooter>
    </Card>
  );
};

export default RedditItemCard;
