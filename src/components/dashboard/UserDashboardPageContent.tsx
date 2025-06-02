
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { User, RedditPost } from '@/types';
import UserAssignedKeywords from './UserAssignedKeywords';
import UserAnalyticsOverview from './UserAnalyticsOverview';
import UserRecentYouTubeActivity from './UserRecentYouTubeActivity';
import UserTrendingMentions from './UserTrendingMentions';
import { searchReddit } from '@/lib/reddit-api-service';
import { getFilteredData, mockTweets, mockMentions } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';

interface UserDashboardPageContentProps {
  user: User | null;
}

const UserDashboardPageContent: React.FC<UserDashboardPageContentProps> = ({ user }) => {
  const { toast } = useToast();

  const [youtubeTrackedCount, setYoutubeTrackedCount] = useState<number | null>(null);
  const [redditMatchedCount, setRedditMatchedCount] = useState<number | null>(null);
  const [twitterMentionsCount, setTwitterMentionsCount] = useState<number | null>(null);
  const [globalMentionsCount, setGlobalMentionsCount] = useState<number | null>(null);
  
  const [isLoadingReddit, setIsLoadingReddit] = useState<boolean>(false);
  // Other counts are derived synchronously or from user object directly

  const calculateCounts = useCallback(() => {
    if (!user) return;

    // YouTube Tracked Count
    setYoutubeTrackedCount(user.assignedYoutubeUrls?.length ?? 0);

    // Twitter/X Mentions Count
    setTwitterMentionsCount(getFilteredData(mockTweets, user).length);

    // Global Mentions Count
    setGlobalMentionsCount(getFilteredData(mockMentions, user).length);

  }, [user]);

  useEffect(() => {
    calculateCounts();
  }, [calculateCounts]);

  useEffect(() => {
    const fetchRedditData = async () => {
      if (user && user.assignedKeywords && user.assignedKeywords.length > 0) {
        setIsLoadingReddit(true);
        setRedditMatchedCount(null); // Reset before fetching
        try {
          const query = user.assignedKeywords.join(' OR ');
          const { data, error } = await searchReddit({ q: query, limit: 100 }); // Fetch up to 100 to count
          if (error) {
            toast({ variant: "destructive", title: "Reddit Count Error", description: "Could not fetch Reddit post count." });
            setRedditMatchedCount(0);
          } else {
            setRedditMatchedCount(data?.length ?? 0);
          }
        } catch (e) {
          toast({ variant: "destructive", title: "Reddit Count Error", description: "An unexpected error occurred." });
          setRedditMatchedCount(0);
        } finally {
          setIsLoadingReddit(false);
        }
      } else {
        setRedditMatchedCount(0); // No keywords, so 0 posts
      }
    };

    fetchRedditData();
  }, [user, toast]);

  // Combined loading state for overview cards
  // For now, only Reddit is async for the counts shown in overview.
  // YouTube count is direct from user object. Twitter/Global are from sync mock data.
  const isLoadingOverview = isLoadingReddit || 
                            youtubeTrackedCount === null || 
                            twitterMentionsCount === null || 
                            globalMentionsCount === null;


  return (
    <>
      <UserAssignedKeywords keywords={user?.assignedKeywords} />
      <UserAnalyticsOverview
        youtubeTrackedCount={youtubeTrackedCount}
        redditMatchedCount={redditMatchedCount}
        twitterMentionsCount={twitterMentionsCount}
        globalMentionsCount={globalMentionsCount}
        isLoading={isLoadingOverview}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <UserRecentYouTubeActivity />
        <UserTrendingMentions keywords={user?.assignedKeywords} />
      </div>
    </>
  );
};

export default UserDashboardPageContent;
