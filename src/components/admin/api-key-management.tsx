
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const APIKeyManagement: React.FC = () => {
  return (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 text-white">
      <CardHeader>
        <CardTitle>API Key Management</CardTitle>
        <CardDescription className="text-slate-400">
          Configure API keys for external services like YouTube, Twitter, etc.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="youtube-api-key" className="text-slate-300">YouTube Data API Key</Label>
          <div className="flex gap-2">
            <Input id="youtube-api-key" type="password" placeholder="Enter YouTube API Key" className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:ring-blue-500" />
            <Button variant="outline" className="border-slate-600 hover:bg-slate-700">Save</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="twitter-api-key" className="text-slate-300">Twitter/X API Key</Label>
           <div className="flex gap-2">
            <Input id="twitter-api-key" type="password" placeholder="Enter Twitter/X API Key" className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:ring-blue-500" />
            <Button variant="outline" className="border-slate-600 hover:bg-slate-700">Save</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reddit-api-key" className="text-slate-300">Reddit API Credentials</Label>
           <div className="flex gap-2">
            <Input id="reddit-client-id" placeholder="Reddit Client ID" className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:ring-blue-500" />
            <Input id="reddit-client-secret" type="password" placeholder="Reddit Client Secret" className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:ring-blue-500" />
            <Button variant="outline" className="border-slate-600 hover:bg-slate-700">Save</Button>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Note: API key storage and management should be handled securely on the backend. This is a UI placeholder.
        </p>
      </CardContent>
    </Card>
  );
};

export default APIKeyManagement;
