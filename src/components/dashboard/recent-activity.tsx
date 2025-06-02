
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const RecentActivity = () => {
  // This data is static as per the reference. 
  // In a real app, this would come from a backend or state management.
  const activities = [
    {
      id: '1',
      color: 'bg-blue-500', // Using theme-consistent colors or direct Tailwind colors
      description: 'New YouTube video tracked: "AI in 2024"',
      time: '2 hours ago',
    },
    {
      id: '2',
      color: 'bg-green-500',
      description: 'User John Doe logged in',
      time: '4 hours ago',
    },
    {
      id: '3',
      color: 'bg-purple-500',
      description: 'New keyword "machine learning" added',
      time: '6 hours ago',
    },
     {
      id: '4',
      color: 'bg-yellow-500',
      description: 'Reddit API credentials updated by admin',
      time: '1 day ago',
    },
    {
      id: '5',
      color: 'bg-pink-500',
      description: 'Twitter feed refreshed with 50 new tweets',
      time: '2 days ago',
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className={`w-2.5 h-2.5 ${activity.color} rounded-full mt-[6px] shrink-0`}></div>
              <div>
                <p className="text-card-foreground text-sm">{activity.description}</p>
                <p className="text-muted-foreground text-xs">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
