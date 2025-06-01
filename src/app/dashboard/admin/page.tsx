
"use client";

import React, { useEffect } from 'react';
import AdminAnalyticsCard from '@/components/admin/admin-analytics-card';
import AnalyticsAssignment from '@/components/admin/analytics-assignment';
import APIKeyManagement from '@/components/admin/api-key-management';
import { Youtube, MessageSquare, Twitter, Globe, Users, Activity, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// Dummy data for card values - replace with actual data fetching
const totalUsers = 24; // Example static value
const activeKeywords = 156; // Example static value
const youtubeVideosTracked = 89; // Example static value

// Dummy data for platform overview
const platformOverviewData = {
  youtube: { count: 89, unit: "videos" },
  reddit: { count: 1200, unit: "posts" },
  twitter: { count: 3400, unit: "tweets" },
  mentions: { count: 567, unit: "mentions" },
};

// Dummy recent activity
const recentActivity = [
  { id: 1, type: "youtube", text: "New YouTube video tracked: \"AI in 2024\"", time: "2 hours ago", color: "blue-400" },
  { id: 2, type: "login", text: "User John Doe logged in", time: "4 hours ago", color: "green-400" },
  { id: 3, type: "keyword", text: "New keyword \"machine learning\" added", time: "6 hours ago", color: "purple-400" },
  { id: 4, type: "mention", text: "Mention of 'InsightStream' found on TechBlog", time: "1 day ago", color: "yellow-400"},
];


export default function AdminDashboardPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || currentUser.role !== 'admin') {
        toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to view this page." });
        router.replace('/dashboard');
      }
    }
  }, [currentUser, authLoading, router, toast]);

  if (authLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center bg-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!currentUser || currentUser.role !== 'admin') {
    // This check is mainly for the brief moment before redirection or if redirection fails
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center bg-slate-900">
        <p className="text-muted-foreground">Access Denied. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-2 md:p-0"> {/* Adjusted padding for smaller screens */}
      <div>
        <h1 className="text-3xl font-bold text-foreground font-headline">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of all analytics and system metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AdminAnalyticsCard
          title="Total Users"
          value={totalUsers}
          change={12}
          changeLabel="vs last month"
          icon={<Users className="w-6 h-6 text-primary-foreground" />}
          color="bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
        />
        
        <AdminAnalyticsCard
          title="Active Keywords"
          value={activeKeywords}
          change={-8} // Example of negative change
          changeLabel="vs last week"
          icon={<Activity className="w-6 h-6 text-primary-foreground" />}
          color="bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800"
        />
        
        <AdminAnalyticsCard
          title="YouTube Videos"
          value={youtubeVideosTracked}
          change={15}
          changeLabel="tracked this month"
          icon={<Youtube className="w-6 h-6 text-primary-foreground" />}
          color="bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800"
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-card border border-border p-1 rounded-lg">
          <TabsTrigger value="overview" className="px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md">
            Platform Overview
          </TabsTrigger>
          <TabsTrigger value="assignments" className="px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md">
            Analytics Assignments
          </TabsTrigger>
          <TabsTrigger value="settings" className="px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md">
            API Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-foreground mb-4">Platform Activity</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Youtube className="w-5 h-5 text-red-500" /> {/* Specific color for YouTube */}
                    <span className="text-muted-foreground">YouTube Analytics</span>
                  </div>
                  <span className="text-foreground font-medium">{platformOverviewData.youtube.count.toLocaleString()} {platformOverviewData.youtube.unit}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <MessageSquare className="w-5 h-5 text-orange-500" /> {/* Specific color for Reddit-like */}
                    <span className="text-muted-foreground">Reddit Analytics</span>
                  </div>
                  <span className="text-foreground font-medium">{platformOverviewData.reddit.count.toLocaleString()} {platformOverviewData.reddit.unit}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Twitter className="w-5 h-5 text-sky-500" /> {/* Specific color for Twitter */}
                    <span className="text-muted-foreground">Twitter Analytics</span>
                  </div>
                  <span className="text-foreground font-medium">{platformOverviewData.twitter.count.toLocaleString()} {platformOverviewData.twitter.unit}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Globe className="w-5 h-5 text-green-500" /> {/* Specific color for Globe */}
                    <span className="text-muted-foreground">Global Mentions</span>
                  </div>
                  <span className="text-foreground font-medium">{platformOverviewData.mentions.count.toLocaleString()} {platformOverviewData.mentions.unit}</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-foreground mb-4">Recent Activity</h2>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {recentActivity.map(activity => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className={`w-2.5 h-2.5 bg-${activity.color} rounded-full mt-1.5 shrink-0`}></div> {/* Dynamic color kept as is */}
                    <div>
                      <p className="text-muted-foreground text-sm">{activity.text}</p>
                      <p className="text-xs text-muted-foreground/70">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="assignments">
          <AnalyticsAssignment />
        </TabsContent>

        <TabsContent value="settings">
          <APIKeyManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
