
"use client";
import React, { useState, useEffect } from 'react';
import { AnalyticsCard } from '../analytics/analytics-card'; 
import { Users, Activity, Youtube as YoutubeIcon, Loader2 } from 'lucide-react'; 
// Removed: useAuth and mock data imports as they are no longer needed for YouTube count here
import { getUsers } from '@/lib/user-service'; 
import type { User } from '@/types';

const DashboardCards = () => {
  const [totalUsersCount, setTotalUsersCount] = useState<number | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  
  const [activeKeywordsCount, setActiveKeywordsCount] = useState<number | null>(null);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState<boolean>(true);

  const [totalYoutubeVideosCount, setTotalYoutubeVideosCount] = useState<number | null>(null);
  const [isLoadingYoutubeVideos, setIsLoadingYoutubeVideos] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoadingUsers(true);
      setIsLoadingKeywords(true);
      setIsLoadingYoutubeVideos(true);

      try {
        const users: User[] = await getUsers();
        setTotalUsersCount(users.length);

        // Calculate unique active keywords
        const allKeywords = users.reduce((acc, currentUser) => {
          if (currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0) {
            acc.push(...currentUser.assignedKeywords);
          }
          return acc;
        }, [] as string[]);
        const uniqueKeywords = new Set(allKeywords);
        setActiveKeywordsCount(uniqueKeywords.size);

        // Calculate total unique YouTube video URLs
        const allYoutubeUrls = users.reduce((acc, currentUser) => {
          if (currentUser.assignedYoutubeUrls && currentUser.assignedYoutubeUrls.length > 0) {
            acc.push(...currentUser.assignedYoutubeUrls);
          }
          return acc;
        }, [] as string[]);
        const uniqueYoutubeUrls = new Set(allYoutubeUrls);
        setTotalYoutubeVideosCount(uniqueYoutubeUrls.size);

      } catch (error) {
        console.error("Failed to fetch dashboard card data:", error);
        setTotalUsersCount(0); 
        setActiveKeywordsCount(0);
        setTotalYoutubeVideosCount(0);
      } finally {
        setIsLoadingUsers(false);
        setIsLoadingKeywords(false);
        setIsLoadingYoutubeVideos(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AnalyticsCard
        title="Total Users"
        value={isLoadingUsers ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : (totalUsersCount ?? 'N/A')}
        change={12} // Placeholder change value
        changeLabel="vs last month"
        icon={<Users className="w-6 h-6 text-white" />}
        cardClassName="bg-gradient-to-r from-blue-500 to-blue-600 text-primary-foreground"
        className="text-primary-foreground"
      />
      
      <AnalyticsCard
        title="Active Keywords"
        value={isLoadingKeywords ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : (activeKeywordsCount ?? 'N/A')}
        change={8} // Placeholder change value
        changeLabel="vs last week"
        icon={<Activity className="w-6 h-6 text-white" />}
        cardClassName="bg-gradient-to-r from-purple-500 to-purple-600 text-primary-foreground"
        className="text-primary-foreground"
      />
      
      <AnalyticsCard
        title="YouTube Videos Tracked"
        value={isLoadingYoutubeVideos ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : (totalYoutubeVideosCount ?? 'N/A')} 
        change={5} // Placeholder change value
        changeLabel="new this week"
        icon={<YoutubeIcon className="w-6 h-6 text-white" />} 
        cardClassName="bg-gradient-to-r from-red-500 to-red-600 text-primary-foreground"
        className="text-primary-foreground"
      />
    </div>
  );
};

export default DashboardCards;
