
"use client";

import React, { useMemo } from 'react';
import type { RedditPost } from '@/types';
import StatCard from './StatCard';
import { MessageCircleMore, Megaphone, Share2, Smile, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface RedditAnalyticsSummaryProps {
  posts: RedditPost[];
}

function formatNumber(num: number): string {
  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

const RedditAnalyticsSummary: React.FC<RedditAnalyticsSummaryProps> = ({ posts }) => {
  const summary = useMemo(() => {
    const totalMentions = posts.length;
    
    const uniqueAuthors = new Set(posts.map(post => post.author));
    const socialReach = uniqueAuthors.size;

    const totalScore = posts.reduce((sum, post) => sum + (post.score || 0), 0);
    
    const positiveSentiments = posts.filter(post => post.sentiment === 'positive').length;
    const negativeSentiments = posts.filter(post => post.sentiment === 'negative').length;
    const neutralSentiments = posts.filter(post => post.sentiment === 'neutral').length;

    return {
      totalMentions,
      socialReach,
      totalScore,
      positiveSentiments,
      negativeSentiments,
      neutralSentiments,
    };
  }, [posts]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        title="Total Mentions"
        value={`${summary.totalMentions} total`}
        icon={MessageCircleMore}
        iconBgClass="bg-pink-600"
      />
      <StatCard
        title="Social Reach"
        value={
          <div className="flex items-baseline">
            <p className="text-xl font-bold text-card-foreground">{formatNumber(summary.socialReach)}</p>
            <span className="text-xs text-muted-foreground ml-1">unique authors</span>
          </div>
        }
        icon={Megaphone}
        iconBgClass="bg-sky-500"
      />
      <StatCard
        title="Social Engagement"
        value={
          <div className="flex items-baseline">
            <p className="text-xl font-bold text-card-foreground">{formatNumber(summary.totalScore)}</p>
            <span className="text-xs text-muted-foreground ml-1">total score</span>
          </div>
        }
        icon={Share2}
        iconBgClass="bg-orange-500"
      />
      <StatCard
        title="Sentiment Analysis"
        value={
          <div className="text-sm">
            <div className="flex items-center text-green-600">
              <TrendingUp className="h-4 w-4 mr-1" /> 
              {summary.positiveSentiments} positive
            </div>
            <div className="flex items-center text-red-600">
              <TrendingDown className="h-4 w-4 mr-1" />
              {summary.negativeSentiments} negative
            </div>
             <div className="flex items-center text-gray-500">
              <Minus className="h-4 w-4 mr-1" />
              {summary.neutralSentiments} neutral
            </div>
          </div>
        }
        icon={Smile}
        iconBgClass="bg-green-500"
      />
    </div>
  );
};

export default RedditAnalyticsSummary;
