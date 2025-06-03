
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { User } from '@/types'; // Removed RedditPost as it's not directly used for type here
import UserAssignedKeywords from './UserAssignedKeywords';
import UserAnalyticsOverview from './UserAnalyticsOverview';
import UserRecentYouTubeActivity from './UserRecentYouTubeActivity';
import UserTrendingMentions from './UserTrendingMentions';
import { getStoredRedditFeedForUser } from '@/lib/reddit-api-service'; // Correct import
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
  
  const [isLoadingRedditCount, setIsLoadingRedditCount] = useState<boolean>(false);

  const calculateCounts = useCallback(() => {
    if (!user) return;

    setYoutubeTrackedCount(user.assignedYoutubeUrls?.length ?? 0);
    setTwitterMentionsCount(getFilteredData(mockTweets, user).length);
    setGlobalMentionsCount(getFilteredData(mockMentions, user).length);

  }, [user]);

  useEffect(() => {
    calculateCounts();
  }, [calculateCounts]);

  useEffect(() => {
    const fetchRedditDataCount = async () => {
      if (user && user.id) { // Ensure user and user.id are available
        setIsLoadingRedditCount(true);
        setRedditMatchedCount(null); 
        try {
          // Use getStoredRedditFeedForUser to get the items and then count them
          const storedItems = await getStoredRedditFeedForUser(user.id);
          setRedditMatchedCount(storedItems.length);
        } catch (e) {
          toast({ variant: "destructive", title: "Reddit Count Error", description: "Could not fetch Reddit post count." });
          setRedditMatchedCount(0);
        } finally {
          setIsLoadingRedditCount(false);
        }
      } else {
        setRedditMatchedCount(0); 
        setIsLoadingRedditCount(false);
      }
    };

    fetchRedditDataCount();
  }, [user, toast]);

  const isLoadingOverview = isLoadingRedditCount || 
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
