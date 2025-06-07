
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { User, YouTubeMentionItem } from '@/types';
import UserAssignedKeywords from './UserAssignedKeywords';
import UserAnalyticsOverview from './UserAnalyticsOverview';
import UserRecentYouTubeActivity from './UserRecentYouTubeActivity';
import UserTrendingMentions from './UserTrendingMentions';
import { getStoredRedditFeedForUser } from '@/lib/reddit-api-service';
import { getFilteredData, mockTweets, mockMentions } from '@/lib/mock-data';
import { getStoredYouTubeMentions } from '@/lib/youtube-video-service';
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

  const [youtubeMentions, setYoutubeMentions] = useState<YouTubeMentionItem[]>([]);
  const [isLoadingYoutubeMentions, setIsLoadingYoutubeMentions] = useState<boolean>(false);
  const [youtubeMentionsError, setYoutubeMentionsError] = useState<string | null>(null);


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
      if (user && user.id) {
        setIsLoadingRedditCount(true);
        setRedditMatchedCount(null); 
        try {
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

  useEffect(() => {
    const fetchUserYouTubeMentionsFromFirestore = async () => {
      if (user && user.id) {
        setIsLoadingYoutubeMentions(true);
        setYoutubeMentionsError(null);
        try {
          const storedMentions = await getStoredYouTubeMentions(user.id);
          setYoutubeMentions(storedMentions);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Failed to load YouTube mentions for dashboard.";
          setYoutubeMentionsError(msg);
          setYoutubeMentions([]);
        } finally {
          setIsLoadingYoutubeMentions(false);
        }
      } else {
        setYoutubeMentions([]);
        setIsLoadingYoutubeMentions(false);
        setYoutubeMentionsError(null);
      }
    };

    if (user?.role === 'user') {
      fetchUserYouTubeMentionsFromFirestore();
    }
  }, [user]);


  const isLoadingOverview = isLoadingRedditCount || 
                            youtubeTrackedCount === null || 
                            twitterMentionsCount === null || 
                            globalMentionsCount === null ||
                            isLoadingYoutubeMentions;


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
        <UserRecentYouTubeActivity 
          mentions={youtubeMentions}
          isLoading={isLoadingYoutubeMentions}
          error={youtubeMentionsError}
          keywordsUsed={user?.assignedKeywords}
        />
        <UserTrendingMentions keywords={user?.assignedKeywords} />
      </div>
    </>
  );
};

export default UserDashboardPageContent;
