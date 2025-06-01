"use client";

import { AnalyticsCard } from '@/components/analytics/analytics-card';
import { useAuth } from '@/contexts/auth-context';
import { getFilteredData, mockYoutubeVideos, mockRedditPosts, mockTweets, mockMentions } from '@/lib/mock-data';
import { Youtube, Reddit, Twitter, Globe, Users, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  // In a real app, these counts would come from aggregated API calls or a database
  const youtubeCount = getFilteredData(mockYoutubeVideos, user).length;
  const redditCount = getFilteredData(mockRedditPosts, user).length;
  const twitterCount = getFilteredData(mockTweets, user).length;
  const mentionsCount = getFilteredData(mockMentions, user).length;

  const summaryStats = [
    { title: "Total YouTube Videos", value: youtubeCount.toString(), description: "Tracked videos and channels", icon: Youtube, href: "/dashboard/youtube" },
    { title: "Monitored Reddit Posts", value: redditCount.toString(), description: "Posts matching keywords", icon: Reddit, href: "/dashboard/reddit" },
    { title: "Relevant Twitter/X Activity", value: twitterCount.toString(), description: "Tweets, comments, and replies", icon: Twitter, href: "/dashboard/twitter" },
    { title: "Global Mentions Found", value: mentionsCount.toString(), description: "Across news, blogs, and forums", icon: Globe, href: "/dashboard/mentions" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight font-headline">
          Welcome, {user?.name || 'Analyst'}!
        </h2>
        <p className="text-muted-foreground">
          Here's a quick overview of your social media landscape.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryStats.map((stat) => (
          <AnalyticsCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            icon={stat.icon}
            href={stat.href}
          />
        ))}
      </div>

      {/* Placeholder for more charts or summary data */}
      <div className="grid gap-4 md:grid-cols-2">
         {/* Example: 
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
         */}
      </div>
    </div>
  );
}
