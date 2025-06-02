
"use client";
import React, { useState, useEffect } from 'react';
import { AnalyticsCard } from '../analytics/analytics-card'; 
import { Users, Activity, Youtube as YoutubeIcon, Loader2 } from 'lucide-react'; 
import { useAuth } from '@/contexts/auth-context';
import { getFilteredData, mockYoutubeVideos } from '@/lib/mock-data'; 
import { getUsers } from '@/lib/user-service'; 

const DashboardCards = () => {
  const { user } = useAuth();

  const [totalUsersCount, setTotalUsersCount] = useState<number | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  
  const [activeKeywordsCount, setActiveKeywordsCount] = useState<number | null>(null);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState<boolean>(true);

  // Fetch total users count
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoadingUsers(true);
      setIsLoadingKeywords(true);
      try {
        const users = await getUsers();
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

      } catch (error) {
        console.error("Failed to fetch dashboard card data:", error);
        setTotalUsersCount(0); // Fallback to 0 on error
        setActiveKeywordsCount(0); // Fallback to 0 on error
      } finally {
        setIsLoadingUsers(false);
        setIsLoadingKeywords(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Using existing logic for YouTube videos count (mock data)
  const youtubeCount = getFilteredData(mockYoutubeVideos, user).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AnalyticsCard
        title="Total Users"
        value={isLoadingUsers ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : (totalUsersCount ?? 'N/A')}
        change={12} 
        changeLabel="vs last month"
        icon={<Users className="w-6 h-6 text-white" />}
        cardClassName="bg-gradient-to-r from-blue-500 to-blue-600 text-primary-foreground"
        className="text-primary-foreground"
      />
      
      <AnalyticsCard
        title="Active Keywords"
        value={isLoadingKeywords ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : (activeKeywordsCount ?? 'N/A')}
        change={8} 
        changeLabel="vs last week"
        icon={<Activity className="w-6 h-6 text-white" />}
        cardClassName="bg-gradient-to-r from-purple-500 to-purple-600 text-primary-foreground"
        className="text-primary-foreground"
      />
      
      <AnalyticsCard
        title="YouTube Videos"
        value={youtubeCount} 
        change={15} 
        changeLabel="tracked this month"
        icon={<YoutubeIcon className="w-6 h-6 text-white" />} 
        cardClassName="bg-gradient-to-r from-red-500 to-red-600 text-primary-foreground"
        className="text-primary-foreground"
      />
    </div>
  );
};

export default DashboardCards;
