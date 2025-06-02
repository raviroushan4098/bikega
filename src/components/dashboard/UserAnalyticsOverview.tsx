
"use client";

import React from 'react';
import { AnalyticsCard } from '@/components/analytics/analytics-card';
import { Youtube, MessageSquareText, Twitter, Globe, Loader2 } from 'lucide-react';

interface UserAnalyticsOverviewProps {
  youtubeTrackedCount: number | null;
  redditMatchedCount: number | null;
  twitterMentionsCount: number | null;
  globalMentionsCount: number | null;
  isLoading: boolean;
}

const UserAnalyticsOverview: React.FC<UserAnalyticsOverviewProps> = ({
  youtubeTrackedCount,
  redditMatchedCount,
  twitterMentionsCount,
  globalMentionsCount,
  isLoading,
}) => {
  const renderValue = (count: number | null) => {
    if (isLoading && count === null) {
      return <Loader2 className="w-6 h-6 animate-spin text-primary-foreground" />;
    }
    return count ?? '0';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <AnalyticsCard
        title="YouTube Videos Tracked"
        value={renderValue(youtubeTrackedCount)}
        // change={2} // Placeholder, dynamic change can be added later
        // changeLabel="new this week"
        description={isLoading && youtubeTrackedCount === null ? "Loading..." : `${youtubeTrackedCount ?? 0} videos assigned`}
        icon={<Youtube className="w-6 h-6 text-primary-foreground" />}
        cardClassName="bg-gradient-to-r from-red-500 to-red-600 text-primary-foreground"
      />
      
      <AnalyticsCard
        title="Reddit Posts Matched"
        value={renderValue(redditMatchedCount)}
        // change={5} // Placeholder
        // changeLabel="today"
        description={isLoading && redditMatchedCount === null ? "Loading..." : `${redditMatchedCount ?? 0} posts found`}
        icon={<MessageSquareText className="w-6 h-6 text-primary-foreground" />}
        cardClassName="bg-gradient-to-r from-orange-500 to-orange-600 text-primary-foreground"
      />
      
      <AnalyticsCard
        title="Twitter/X Mentions"
        value={renderValue(twitterMentionsCount)}
        // change={-3} // Placeholder
        // changeLabel="vs yesterday"
        description={isLoading && twitterMentionsCount === null ? "Loading..." : `${twitterMentionsCount ?? 0} mentions found`}
        icon={<Twitter className="w-6 h-6 text-primary-foreground" />}
        cardClassName="bg-gradient-to-r from-blue-500 to-blue-600 text-primary-foreground"
      />
      
      <AnalyticsCard
        title="Global Keyword Mentions"
        value={renderValue(globalMentionsCount)}
        // change={4} // Placeholder
        // changeLabel="this week"
        description={isLoading && globalMentionsCount === null ? "Loading..." : `${globalMentionsCount ?? 0} global mentions`}
        icon={<Globe className="w-6 h-6 text-primary-foreground" />}
        cardClassName="bg-gradient-to-r from-green-500 to-green-600 text-primary-foreground"
      />
    </div>
  );
};

export default UserAnalyticsOverview;
