
"use client";

import React from 'react';
import { useAuth } from '@/contexts/auth-context';
import DashboardCards from '@/components/dashboard/dashboard-cards';
import PlatformOverview from '@/components/dashboard/platform-overview';
import RecentActivity from '@/components/dashboard/recent-activity';
import UserDashboardPageContent from '@/components/dashboard/UserDashboardPageContent';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {user?.role === 'user' ? (
        <>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline">
              My Analytics Dashboard
            </h2>
            <p className="text-muted-foreground mt-1">
              Your assigned analytics and metrics based on your keywords.
            </p>
          </div>
          <UserDashboardPageContent user={user} />
        </>
      ) : (
        <>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline">
              Welcome, {user?.name || 'Administrator'}!
            </h2>
            <p className="text-muted-foreground mt-1">
              Here's a comprehensive overview of the platform's social media landscape.
            </p>
          </div>
          <DashboardCards />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <PlatformOverview />
            </div>
            <div className="lg:col-span-2">
              <RecentActivity />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
