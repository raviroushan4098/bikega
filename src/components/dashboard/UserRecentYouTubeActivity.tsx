
"use client";

import React from 'react';
import { Youtube } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const UserRecentYouTubeActivity: React.FC = () => {
  // Placeholder data
  const activities = [
    {
      id: '1',
      title: 'New video: "AI Revolution in Tech"',
      details: '1.2k views • 2 hours ago',
      url: '#', // Placeholder URL
    },
    {
      id: '2',
      title: 'Tracked: "Startup Success Stories"',
      details: '856 views • 5 hours ago',
      url: '#', // Placeholder URL
    },
    {
      id: '3',
      title: 'Analyzed: "Future of Web Development"',
      details: '2.5k views • 1 day ago',
      url: '#', // Placeholder URL
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent YouTube Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3">
              <Youtube className="w-5 h-5 text-destructive mt-1 flex-shrink-0" />
              <div>
                <a href={activity.url} target="_blank" rel="noopener noreferrer" className="text-sm text-card-foreground hover:underline hover:text-primary transition-colors">
                  {activity.title}
                </a>
                <p className="text-xs text-muted-foreground">{activity.details}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default UserRecentYouTubeActivity;
