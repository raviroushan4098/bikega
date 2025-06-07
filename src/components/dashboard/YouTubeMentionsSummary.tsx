
"use client";

import React, { useMemo } from 'react';
import type { YouTubeMentionItem } from '@/types';
import StatCard from './StatCard';
import { MessageSquare, Eye, ThumbsUp, Smile, TrendingUp, TrendingDown, Minus } from 'lucide-react'; // Added Trending icons

interface YouTubeMentionsSummaryProps {
  mentions: YouTubeMentionItem[];
}

function formatStatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return '0';
  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

const YouTubeMentionsSummary: React.FC<YouTubeMentionsSummaryProps> = ({ mentions }) => {
  const summary = useMemo(() => {
    const totalMentions = mentions.length;
    const totalViews = mentions.reduce((sum, mention) => sum + (mention.viewCount || 0), 0);
    const totalLikes = mentions.reduce((sum, mention) => sum + (mention.likeCount || 0), 0);
    const totalCommentsOnMentions = mentions.reduce((sum, mention) => sum + (mention.commentCount || 0), 0);
    const totalEngagement = totalLikes + totalCommentsOnMentions;

    const positiveSentiments = mentions.filter(m => m.sentiment === 'positive').length;
    const negativeSentiments = mentions.filter(m => m.sentiment === 'negative').length;
    const neutralSentiments = mentions.filter(m => m.sentiment === 'neutral').length;
    const unknownSentiments = mentions.filter(m => m.sentiment === 'unknown' || !m.sentiment).length;


    return {
      totalMentions,
      totalViews,
      totalEngagement,
      positiveSentiments,
      negativeSentiments,
      neutralSentiments,
      unknownSentiments
    };
  }, [mentions]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        title="Total Mentions"
        value={
          <div className="flex items-baseline">
            <p className="text-xl font-bold text-card-foreground">{formatStatNumber(summary.totalMentions)}</p>
            <span className="text-xs text-muted-foreground ml-1">total</span>
          </div>
        }
        icon={MessageSquare}
        iconBgClass="bg-pink-600" 
      />
      <StatCard
        title="Total Views" 
        value={
          <div className="flex items-baseline">
            <p className="text-xl font-bold text-card-foreground">{formatStatNumber(summary.totalViews)}</p>
            <span className="text-xs text-muted-foreground ml-1">views</span>
          </div>
        }
        icon={Eye}
        iconBgClass="bg-sky-500" 
      />
      <StatCard
        title="Total Engagement"
        value={
          <div className="flex items-baseline">
            <p className="text-xl font-bold text-card-foreground">{formatStatNumber(summary.totalEngagement)}</p>
            <span className="text-xs text-muted-foreground ml-1">interactions</span>
          </div>
        }
        icon={ThumbsUp} 
        iconBgClass="bg-orange-500" 
      />
      <StatCard
        title="Mention Sentiment"
        value={
          <div className="text-sm space-y-0.5">
            <div className="flex items-center text-green-600">
              <TrendingUp className="h-3.5 w-3.5 mr-1" /> 
              {summary.positiveSentiments} positive
            </div>
            <div className="flex items-center text-red-600">
              <TrendingDown className="h-3.5 w-3.5 mr-1" />
              {summary.negativeSentiments} negative
            </div>
             <div className="flex items-center text-gray-500">
              <Minus className="h-3.5 w-3.5 mr-1" />
              {summary.neutralSentiments} neutral
            </div>
            {summary.unknownSentiments > 0 && (
                <div className="text-xs text-muted-foreground/80">
                    ({summary.unknownSentiments} unknown)
                </div>
            )}
          </div>
        }
        icon={Smile}
        iconBgClass="bg-green-500" 
      />
    </div>
  );
};

export default YouTubeMentionsSummary;

