
"use client";

import React from 'react';
import type { User } from '@/types';
import UserAssignedKeywords from './UserAssignedKeywords';
import UserAnalyticsOverview from './UserAnalyticsOverview';
import UserRecentYouTubeActivity from './UserRecentYouTubeActivity';
import UserTrendingMentions from './UserTrendingMentions';

interface UserDashboardPageContentProps {
  user: User | null;
}

const UserDashboardPageContent: React.FC<UserDashboardPageContentProps> = ({ user }) => {
  return (
    <>
      <UserAssignedKeywords keywords={user?.assignedKeywords} />
      <UserAnalyticsOverview />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserRecentYouTubeActivity />
        <UserTrendingMentions />
      </div>
    </>
  );
};

export default UserDashboardPageContent;
