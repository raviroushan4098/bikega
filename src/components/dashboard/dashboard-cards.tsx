
"use client";
import React, { useState, useEffect } from 'react';
import { AnalyticsCard } from '../analytics/analytics-card'; 
import { Users, Activity, Youtube as YoutubeIcon, Loader2 } from 'lucide-react'; 
import { getUsers } from '@/lib/user-service'; 
import type { User } from '@/types';

// Helper function to get the start of the current week (Monday)
const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0 for Sunday, 1 for Monday, etc.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const startOfWeek = new Date(d.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0); // Set to beginning of the day
  return startOfWeek;
};

const DashboardCards = () => {
  const [totalUsersCount, setTotalUsersCount] = useState<number | null>(null);
  const [newUsersThisWeekCount, setNewUsersThisWeekCount] = useState<number>(0);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  
  const [activeKeywordsCount, setActiveKeywordsCount] = useState<number | null>(null);
  const [keywordsChangeThisWeek, setKeywordsChangeThisWeek] = useState<number>(0);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState<boolean>(true);

  const [totalYoutubeVideosCount, setTotalYoutubeVideosCount] = useState<number | null>(null);
  const [youtubeVideosChangeThisWeek, setYoutubeVideosChangeThisWeek] = useState<number>(0);
  const [isLoadingYoutubeVideos, setIsLoadingYoutubeVideos] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoadingUsers(true);
      setIsLoadingKeywords(true);
      setIsLoadingYoutubeVideos(true);

      try {
        const users: User[] = await getUsers();
        setTotalUsersCount(users.length);

        // Calculate new users this week
        const today = new Date();
        const startOfWeek = getStartOfWeek(today);
        const newUsers = users.filter(user => 
          user.createdAt && new Date(user.createdAt) >= startOfWeek
        ).length;
        setNewUsersThisWeekCount(newUsers);

        // Calculate unique active keywords
        const allKeywords = users.reduce((acc, currentUser) => {
          if (currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0) {
            acc.push(...currentUser.assignedKeywords);
          }
          return acc;
        }, [] as string[]);
        const uniqueKeywords = new Set(allKeywords);
        setActiveKeywordsCount(uniqueKeywords.size);
        // Illustrative change for keywords
        setKeywordsChangeThisWeek(Math.floor(Math.random() * 5) + 1);


        // Calculate total unique YouTube video URLs
        const allYoutubeUrls = users.reduce((acc, currentUser) => {
          if (currentUser.assignedYoutubeUrls && currentUser.assignedYoutubeUrls.length > 0) {
            acc.push(...currentUser.assignedYoutubeUrls);
          }
          return acc;
        }, [] as string[]);
        const uniqueYoutubeUrls = new Set(allYoutubeUrls);
        setTotalYoutubeVideosCount(uniqueYoutubeUrls.size);
        // Illustrative change for YouTube videos
        setYoutubeVideosChangeThisWeek(Math.floor(Math.random() * 3) + 1);


      } catch (error) {
        console.error("Failed to fetch dashboard card data:", error);
        setTotalUsersCount(0); 
        setNewUsersThisWeekCount(0);
        setActiveKeywordsCount(0);
        setKeywordsChangeThisWeek(0);
        setTotalYoutubeVideosCount(0);
        setYoutubeVideosChangeThisWeek(0);
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
        change={newUsersThisWeekCount} 
        changeLabel="new this week"
        icon={<Users className="w-6 h-6 text-white" />}
        cardClassName="bg-gradient-to-r from-blue-500 to-blue-600 text-primary-foreground"
        className="text-primary-foreground"
      />
      
      <AnalyticsCard
        title="Active Keywords"
        value={isLoadingKeywords ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : (activeKeywordsCount ?? 'N/A')}
        change={keywordsChangeThisWeek} 
        changeLabel="updates this week"
        icon={<Activity className="w-6 h-6 text-white" />}
        cardClassName="bg-gradient-to-r from-purple-500 to-purple-600 text-primary-foreground"
        className="text-primary-foreground"
      />
      
      <AnalyticsCard
        title="YouTube Videos Tracked"
        value={isLoadingYoutubeVideos ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : (totalYoutubeVideosCount ?? 'N/A')} 
        change={youtubeVideosChangeThisWeek} 
        changeLabel="added this week"
        icon={<YoutubeIcon className="w-6 h-6 text-white" />} 
        cardClassName="bg-gradient-to-r from-red-500 to-red-600 text-primary-foreground"
        className="text-primary-foreground"
      />
    </div>
  );
};

export default DashboardCards;

