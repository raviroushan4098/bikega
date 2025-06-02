
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface UserTrendingMentionsProps {
  keywords?: string[];
}

const UserTrendingMentions: React.FC<UserTrendingMentionsProps> = ({ keywords = [] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Your Monitored Keywords</CardTitle>
      </CardHeader>
      <CardContent>
        {keywords && keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-sm border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
              >
                {keyword}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No keywords are currently being monitored.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default UserTrendingMentions;
