
"use client";
import React, { useState, useEffect } from 'react';
import { Youtube, Twitter, Globe, Loader2 } from 'lucide-react'; // Added Loader2
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUsers } from '@/lib/user-service'; // To fetch all users
import type { User } from '@/types';

// Custom Reddit Icon
const RedditIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0m3.643 14.08c-.224.358-.71.465-1.065.242-.806-.507-1.82-.78-2.89-.78c-1.068 0-2.083.273-2.888.78c-.357.223-.843.116-1.067-.242c-.224-.358-.115-.843.24-1.065c1.01-.634 2.26-.975 3.588-.975c1.33 0 2.58.34 3.59.974c.354.223.462.707.24 1.066M10.15 10.495a1.492 1.492 0 0 0-1.493 1.492a1.492 1.492 0 0 0 1.493 1.493a1.492 1.492 0 0 0 1.492-1.493a1.492 1.492 0 0 0-1.492-1.492m5.194 0a1.492 1.492 0 0 0-1.492 1.492a1.492 1.492 0 0 0 1.492 1.493a1.492 1.492 0 0 0 1.493-1.493a1.492 1.492 0 0 0-1.493-1.492M12 4.516c-.46 0-.892.066-1.29.194c1.31-.62 2.72-1.02 4.22-1.02c2.31 0 4.39.95 5.92 2.52c.23.23.23.61 0 .84c-.23.23-.61.23-.84 0a7.423 7.423 0 0 0-5.08-2.15c.05.16.08.33.08.5c0 .8-.26 1.52-.71 2.11c-.25.33-.09.81.29.95c.09.03.18.05.28.05c.3 0 .57-.16.71-.42c.69-.91 1.08-2.01 1.08-3.19c0-.39-.03-.77-.09-1.14C15.74 4.7 13.98 4.52 12 4.516m-7.036 2.368a7.423 7.423 0 0 0-5.08 2.15c-.23.23-.23.61 0 .84c.23.23.61.23.84 0c1.53-1.57 3.61-2.52 5.92-2.52c1.5 0 2.91.39 4.22 1.02c-.4-.13-.83-.19-1.29-.19c-2.38 0-4.48 1.05-5.92 2.69c-.14.26-.41.42-.71.42c-.1 0-.19-.02-.28-.05c-.38-.14-.54-.62-.29-.95c-.45-.6-.71-1.32-.71-2.12c0-.17.03-.33.08-.5c.002 0 .003 0 .005 0M12 6.705c.63 0 1.23.09 1.79.26c.3.09.62-.08.71-.38c.09-.3-.08-.62-.38-.71A9.37 9.37 0 0 0 12 5.605c-.69 0-1.37.05-2.03.15c-.06.01-.11.02-.17.03c-.3.06-.5.33-.5.63c.04.32.32.53.62.52c.02 0 .03 0 .05-.01c.55-.08 1.12-.13 1.71-.13c.07 0 .13.001.19.003l.08.005a3.14 3.14 0 0 1 .07.003zm3.29 10.68c.18.14.4.21.61.21c.29 0 .57-.12.78-.35c.49-.56.43-1.39-.13-1.88c-.92-.78-2.22-1.03-3.55-.73c-.34.08-.56.4-.48.74c.08.34.4.56.74.48c.94-.22 1.89-.03 2.55.45c-.01 0-.02.01-.02.01m-8.08.11c.66-.48 1.61-.67 2.55-.45c.34-.08.66.14.74.48c.08.34-.14.66-.48.74c-1.33-.3-2.63-.05-3.55.73c-.56.49-.62 1.32-.13 1.88c.21.23.49.35.78.35c.21 0 .43-.07.61-.21l0 0c0-.01 0-.01 0-.01z"/>
  </svg>
);

const PlatformOverview = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [youtubeCount, setYoutubeCount] = useState<number | null>(null);
  const [uniqueKeywordsCount, setUniqueKeywordsCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchOverviewData = async () => {
      setIsLoading(true);
      try {
        const users: User[] = await getUsers();

        // Calculate unique YouTube videos
        const allYoutubeUrls = users.reduce((acc, currentUser) => {
          if (currentUser.assignedYoutubeUrls && currentUser.assignedYoutubeUrls.length > 0) {
            acc.push(...currentUser.assignedYoutubeUrls);
          }
          return acc;
        }, [] as string[]);
        const uniqueYoutubeUrls = new Set(allYoutubeUrls);
        setYoutubeCount(uniqueYoutubeUrls.size);

        // Calculate unique active keywords
        const allKeywords = users.reduce((acc, currentUser) => {
          if (currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0) {
            acc.push(...currentUser.assignedKeywords);
          }
          return acc;
        }, [] as string[]);
        const uniqueKeywords = new Set(allKeywords.map(kw => kw.toLowerCase())); // Ensure case-insensitivity for unique count
        setUniqueKeywordsCount(uniqueKeywords.size);

      } catch (error) {
        console.error("Failed to fetch platform overview data:", error);
        setYoutubeCount(0);
        setUniqueKeywordsCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverviewData();
  }, []);

  const renderCount = (count: number | null) => {
    if (isLoading) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
    return <span className="text-card-foreground font-medium">{count ?? 'N/A'}</span>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Platform Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Youtube className="w-5 h-5 text-red-500" /> 
              <span className="text-muted-foreground">YouTube Videos Tracked</span>
            </div>
            {renderCount(youtubeCount)}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <RedditIcon className="w-5 h-5 text-orange-500" />
              <span className="text-muted-foreground">Reddit Keywords Active</span>
            </div>
             {renderCount(uniqueKeywordsCount)}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Twitter className="w-5 h-5 text-sky-500" /> 
              <span className="text-muted-foreground">Twitter/X Keywords Active</span>
            </div>
            {renderCount(uniqueKeywordsCount)}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Globe className="w-5 h-5 text-green-500" />
              <span className="text-muted-foreground">Global Mentions Keywords</span>
            </div>
            {renderCount(uniqueKeywordsCount)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlatformOverview;

    