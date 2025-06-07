
"use client";

import React, { useMemo } from 'react';
import type { YouTubeMentionItem } from '@/types';
import StatCard from './StatCard';
import { MessageSquare, Eye, ThumbsUp, Smile } from 'lucide-react'; // Using ThumbsUp for engagement

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
    const totalComments = mentions.reduce((sum, mention) => sum + (mention.commentCount || 0), 0);
    const totalEngagement = totalLikes + totalComments;

    // Sentiment is not available in YouTubeMentionItem, so we'll use placeholders
    const positiveSentiments = 0;
    const negativeSentiments = 0;

    return {
      totalMentions,
      totalViews,
      totalEngagement,
      positiveSentiments,
      negativeSentiments,
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
        iconBgClass="bg-pink-600" // Similar to image 'TOTAL MENTIONS'
      />
      <StatCard
        title="Total Views" // Renamed from "Social Reach" to be more specific to YouTube views
        value={
          <div className="flex items-baseline">
            <p className="text-xl font-bold text-card-foreground">{formatStatNumber(summary.totalViews)}</p>
            <span className="text-xs text-muted-foreground ml-1">views</span>
          </div>
        }
        icon={Eye}
        iconBgClass="bg-sky-500" // Similar to image 'SOCIAL REACH'
      />
      <StatCard
        title="Total Engagement"
        value={
          <div className="flex items-baseline">
            <p className="text-xl font-bold text-card-foreground">{formatStatNumber(summary.totalEngagement)}</p>
            <span className="text-xs text-muted-foreground ml-1">interactions</span>
          </div>
        }
        icon={ThumbsUp} // Using ThumbsUp as a general engagement icon
        iconBgClass="bg-orange-500" // Similar to image 'SOCIAL ENGAGEMENT'
      />
      <StatCard
        title="Sentiment Analysis"
        value={
          <div className="text-sm">
            <div className="flex items-center text-green-600">
              {summary.positiveSentiments} positive
            </div>
            <div className="flex items-center text-red-600">
              {summary.negativeSentiments} negative
            </div>
            <p className="text-xs text-muted-foreground mt-1">(Sentiment N/A for mentions)</p>
          </div>
        }
        icon={Smile}
        iconBgClass="bg-green-500" // Similar to image 'SENTIMENT ANALYSIS'
      />
    </div>
  );
};

export default YouTubeMentionsSummary;
