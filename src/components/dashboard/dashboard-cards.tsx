
"use client";
import React from 'react';
import { AnalyticsCard } from '../analytics/analytics-card'; // Adjusted path
import { Users, Activity, Youtube as YoutubeIcon } from 'lucide-react'; // Renamed Youtube to YoutubeIcon to avoid conflict
import { useAuth } from '@/contexts/auth-context';
import { getFilteredData, mockYoutubeVideos, mockRedditPosts, mockTweets, mockMentions } from '@/lib/mock-data'; // For counts

const DashboardCards = () => {
  const { user } = useAuth();

  // Using existing logic for counts
  const youtubeCount = getFilteredData(mockYoutubeVideos, user).length;
  // For 'Active Keywords', this is a placeholder. In a real app, it would come from a keyword management system.
  // We can sum up assignedKeywords from all users if we fetch them, or use a mock value.
  // For now, let's use a mock value or sum from mock user data.
  // If you have `getUsers` in `user-service` that can be called client-side:
  // const [totalUsers, setTotalUsers] = useState(0);
  // const [activeKeywordsCount, setActiveKeywordsCount] = useState(0);
  // useEffect(() => { async () => { const users = await getUsers(); setTotalUsers(users.length); ... }})
  // For simplicity here, using mock data length for users if available, otherwise static.
  const totalUsers = 24; // Static for now, replace with dynamic data if user-service can provide it easily client-side
  const activeKeywordsCount = 156; // Static

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AnalyticsCard
        title="Total Users"
        value={totalUsers} // Replace with dynamic data if available
        change={12} // Static
        changeLabel="vs last month"
        icon={<Users className="w-6 h-6 text-white" />}
        cardClassName="bg-gradient-to-r from-blue-500 to-blue-600 text-primary-foreground"
        className="text-primary-foreground" // Ensures text inside like title is also white
      />
      
      <AnalyticsCard
        title="Active Keywords"
        value={activeKeywordsCount} // Static
        change={8} // Static
        changeLabel="vs last week"
        icon={<Activity className="w-6 h-6 text-white" />}
        cardClassName="bg-gradient-to-r from-purple-500 to-purple-600 text-primary-foreground"
        className="text-primary-foreground"
      />
      
      <AnalyticsCard
        title="YouTube Videos"
        value={youtubeCount} // Dynamic
        change={15} // Static
        changeLabel="tracked this month"
        icon={<YoutubeIcon className="w-6 h-6 text-white" />} // Use YoutubeIcon
        cardClassName="bg-gradient-to-r from-red-500 to-red-600 text-primary-foreground"
        className="text-primary-foreground"
      />
    </div>
  );
};

export default DashboardCards;
