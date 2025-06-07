
"use client";

import React, { useMemo } from 'react';
import type { YoutubeVideo } from '@/types';
import StatCard from './StatCard';
import { Youtube, Eye, ThumbsUp, MessageSquare } from 'lucide-react';

interface YouTubeAnalyticsSummaryProps {
  videos: YoutubeVideo[];
}

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return '0';
  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

const YouTubeAnalyticsSummary: React.FC<YouTubeAnalyticsSummaryProps> = ({ videos }) => {
  const summary = useMemo(() => {
    const totalVideos = videos.length;
    const totalViews = videos.reduce((sum, video) => sum + (video.viewCount || 0), 0);
    const totalLikes = videos.reduce((sum, video) => sum + (video.likeCount || 0), 0);
    const totalComments = videos.reduce((sum, video) => sum + (video.commentCount || 0), 0);

    return {
      totalVideos,
      totalViews,
      totalLikes,
      totalComments,
    };
  }, [videos]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        title="Total Videos Tracked"
        value={`${summary.totalVideos}`}
        icon={Youtube}
        iconBgClass="bg-red-500" // YouTube red
      />
      <StatCard
        title="Total Views"
         value={
          <div className="flex items-baseline">
            <p className="text-xl font-bold text-card-foreground">{formatNumber(summary.totalViews)}</p>
          </div>
        }
        icon={Eye}
        iconBgClass="bg-sky-500"
      />
      <StatCard
        title="Total Likes"
        value={
          <div className="flex items-baseline">
            <p className="text-xl font-bold text-card-foreground">{formatNumber(summary.totalLikes)}</p>
          </div>
        }
        icon={ThumbsUp}
        iconBgClass="bg-green-500"
      />
      <StatCard
        title="Total Comments"
        value={
          <div className="flex items-baseline">
            <p className="text-xl font-bold text-card-foreground">{formatNumber(summary.totalComments)}</p>
          </div>
        }
        icon={MessageSquare}
        iconBgClass="bg-purple-500"
      />
    </div>
  );
};

export default YouTubeAnalyticsSummary;
