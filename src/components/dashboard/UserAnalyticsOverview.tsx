
"use client";

import React from 'react';
import { AnalyticsCard } from '@/components/analytics/analytics-card'; // Adjusted path
import { Youtube, MessageSquareText, Twitter, Globe } from 'lucide-react'; // MessageSquareText for Reddit

const UserAnalyticsOverview: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <AnalyticsCard
        title="YouTube Videos Tracked"
        value={7} // Placeholder
        change={2} // Placeholder
        changeLabel="new this week"
        icon={<Youtube className="w-6 h-6 text-primary-foreground" />}
        cardClassName="bg-gradient-to-r from-red-500 to-red-600 text-primary-foreground"
      />
      
      <AnalyticsCard
        title="Reddit Posts Matched"
        value={42} // Placeholder
        change={5} // Placeholder
        changeLabel="today"
        icon={<MessageSquareText className="w-6 h-6 text-primary-foreground" />} // Changed icon
        cardClassName="bg-gradient-to-r from-orange-500 to-orange-600 text-primary-foreground"
      />
      
      <AnalyticsCard
        title="Twitter/X Mentions"
        value={18} // Placeholder
        change={-3} // Placeholder
        changeLabel="vs yesterday"
        icon={<Twitter className="w-6 h-6 text-primary-foreground" />}
        cardClassName="bg-gradient-to-r from-blue-500 to-blue-600 text-primary-foreground"
      />
      
      <AnalyticsCard
        title="Global Keyword Mentions"
        value={9} // Placeholder
        change={4} // Placeholder
        changeLabel="this week"
        icon={<Globe className="w-6 h-6 text-primary-foreground" />}
        cardClassName="bg-gradient-to-r from-green-500 to-green-600 text-primary-foreground"
      />
    </div>
  );
};

export default UserAnalyticsOverview;
