
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const APIKeyManagement: React.FC = () => {
  return (
    <Card className="bg-card border-border text-foreground shadow-lg">
      <CardHeader>
        <CardTitle>API Key Management</CardTitle>
        <CardDescription className="text-muted-foreground">
          Configure API keys for external services like YouTube, Twitter, etc.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="youtube-api-key" className="text-muted-foreground">YouTube Data API Key</Label>
          <div className="flex gap-2">
            <Input id="youtube-api-key" type="password" placeholder="Enter YouTube API Key" />
            <Button variant="outline">Save</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="twitter-api-key" className="text-muted-foreground">Twitter/X API Key</Label>
           <div className="flex gap-2">
            <Input id="twitter-api-key" type="password" placeholder="Enter Twitter/X API Key" />
            <Button variant="outline">Save</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reddit-api-key" className="text-muted-foreground">Reddit API Credentials</Label>
           <div className="flex gap-2">
            <Input id="reddit-client-id" placeholder="Reddit Client ID" />
            <Input id="reddit-client-secret" type="password" placeholder="Reddit Client Secret" />
            <Button variant="outline">Save</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground/80">
          Note: API key storage and management should be handled securely on the backend. This is a UI placeholder.
        </p>
      </CardContent>
    </Card>
  );
};

export default APIKeyManagement;
