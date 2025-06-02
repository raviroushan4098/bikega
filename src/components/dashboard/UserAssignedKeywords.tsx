
"use client";

import React from 'react';
import type { User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface UserAssignedKeywordsProps {
  keywords?: string[];
}

const UserAssignedKeywords: React.FC<UserAssignedKeywordsProps> = ({ keywords = [] }) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-muted-foreground">Your Assigned Keywords</CardTitle>
      </CardHeader>
      <CardContent>
        {keywords && keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword, index) => (
              <Badge key={index} variant="secondary" className="text-sm bg-primary/10 text-primary hover:bg-primary/20">
                {keyword}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No keywords assigned yet.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default UserAssignedKeywords;
