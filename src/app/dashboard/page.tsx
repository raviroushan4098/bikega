
"use client";

import React from 'react';
import { useAuth } from '@/contexts/auth-context';
import DashboardCards from '@/components/dashboard/dashboard-cards';
import PlatformOverview from '@/components/dashboard/platform-overview';
import RecentActivity from '@/components/dashboard/recent-activity';
// Removed original AnalyticsCard import as DashboardCards now handles its version

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline">
          Welcome, {user?.name || 'Analyst'}!
        </h2>
        <p className="text-muted-foreground mt-1">
          Here's a quick overview of your social media landscape.
        </p>
      </div>

      <DashboardCards />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-3"> {/* PlatformOverview takes more space */}
          <PlatformOverview />
        </div>
        <div className="lg:col-span-2"> {/* RecentActivity takes less space */}
          <RecentActivity />
        </div>
      </div>
      
      {/* Placeholder for more charts or summary data if needed later
      <div className="grid gap-4 md:grid-cols-2">
         <Card>
           <CardHeader>
             <CardTitle>Overall Sentiment Trend</CardTitle>
             <CardDescription>Placeholder for a sentiment chart</CardDescription>
           </CardHeader>
           <CardContent className="h-[300px] flex items-center justify-center">
             <BarChart3 className="w-16 h-16 text-muted-foreground" />
             <p className="text-muted-foreground">Sentiment chart coming soon...</p>
           </CardContent>
         </Card>
      </div>
      */}
    </div>
  );
}
