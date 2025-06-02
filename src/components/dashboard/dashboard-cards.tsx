
"use client";
import React, { useState, useEffect } from 'react';
import { AnalyticsCard } from '../analytics/analytics-card'; 
import { Users, Activity, Youtube as YoutubeIcon, Loader2 } from 'lucide-react'; 
import { useAuth } from '@/contexts/auth-context';
import { getFilteredData, mockYoutubeVideos } from '@/lib/mock-data'; 
import { getUsers } from '@/lib/user-service'; // Import getUsers

const DashboardCards = () => {
  const { user } = useAuth();

  const [totalUsersCount, setTotalUsersCount] = useState<number | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);

  // Fetch total users count
  useEffect(() => {
    const fetchTotalUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const users = await getUsers();
        setTotalUsersCount(users.length);
      } catch (error) {
        console.error("Failed to fetch total users:", error);
        setTotalUsersCount(0); // Fallback to 0 on error
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchTotalUsers();
  }, []);

  // Using existing logic for other counts
  const youtubeCount = getFilteredData(mockYoutubeVideos, user).length;
  const activeKeywordsCount = 156; // Static for now, as keyword data source is not defined for dynamic counting

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AnalyticsCard
        title="Total Users"
        value={isLoadingUsers ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : (totalUsersCount ?? 'N/A')}
        change={12} // Static for now, as historical data isn't tracked for this dynamic value
        changeLabel="vs last month"
        icon={<Users className="w-6 h-6 text-white" />}
        cardClassName="bg-gradient-to-r from-blue-500 to-blue-600 text-primary-foreground"
        className="text-primary-foreground"
      />
      
      <AnalyticsCard
        title="Active Keywords"
        value={activeKeywordsCount} // Remains static
        change={8} 
        changeLabel="vs last week"
        icon={<Activity className="w-6 h-6 text-white" />}
        cardClassName="bg-gradient-to-r from-purple-500 to-purple-600 text-primary-foreground"
        className="text-primary-foreground"
      />
      
      <AnalyticsCard
        title="YouTube Videos"
        value={youtubeCount} // Dynamic based on mock data + user filter
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
