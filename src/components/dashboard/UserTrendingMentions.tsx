
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

const UserTrendingMentions: React.FC = () => {
  // Placeholder data
  const trends = [
    { id: '1', keyword: 'AI', change: 15, positive: true },
    { id: '2', keyword: 'startup', change: 8, positive: true },
    { id: '3', keyword: 'tech', change: -3, positive: false },
    { id: '4', keyword: 'innovation', change: 12, positive: true },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Trending Keywords</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {trends.map((trend) => (
            <div key={trend.id} className="flex justify-between items-center">
              <span className="text-card-foreground">"{trend.keyword}"</span>
              <span className={`flex items-center text-sm ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.positive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                {trend.positive ? '+' : ''}{trend.change}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default UserTrendingMentions;
