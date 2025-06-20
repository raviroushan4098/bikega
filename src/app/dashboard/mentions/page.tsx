"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { User, Mention } from '@/types';
import { getUsers, getUserById, updateUserRssFeedUrls } from '@/lib/user-service';
import { Globe, Rss, Save, Loader2, Info, FilterX, SearchCheck, SearchX, Users, Link } from 'lucide-react';
import GlobalMentionCard from '@/components/dashboard/GlobalMentionCard';
import RssMentionCard from '@/components/dashboard/RssMentionCard';
import { getGlobalMentionsForUser } from '@/lib/global-mentions-service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

const rssFeedsSchema = z.object({
  rssFeedUrls: z.string().optional(),
});
type RssFeedsFormValues = z.infer<typeof rssFeedsSchema>;

export default function GlobalMentionsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Admin state for assigning RSS Feeds
  const [allUsersForAdmin, setAllUsersForAdmin] = useState<User[]>([]);
  const [selectedUserForFeeds, setSelectedUserForFeeds] = useState<User | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSavingRssFeeds, setIsSavingRssFeeds] = useState(false);

  const rssFeedsForm = useForm<RssFeedsFormValues>({
    resolver: zodResolver(rssFeedsSchema),
    defaultValues: { rssFeedUrls: "" },
  });

  // User state for their mentions (including simulated RSS)
  const [userMentions, setUserMentions] = useState<Mention[]>([]);
  const [isLoadingMentions, setIsLoadingMentions] = useState(false);

  // Admin: Fetch users list
  useEffect(() => {
    if (currentUser?.role === 'admin' && !authLoading) {
      setIsLoadingUsers(true);
      getUsers()
        .then(setAllUsersForAdmin)
        .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to fetch user list." }))
        .finally(() => setIsLoadingUsers(false));
    }
  }, [currentUser, authLoading, toast]);

  // Admin: Handle user selection for RSS feeds
  const handleUserSelectionChange = async (userId: string) => {
    if (!userId) {
      setSelectedUserForFeeds(null);
      rssFeedsForm.reset({ rssFeedUrls: "" });
      return;
    }
    setIsLoadingUsers(true);
    try {
      const userDetails = await getUserById(userId);
      if (userDetails) {
        setSelectedUserForFeeds(userDetails);
        rssFeedsForm.reset({ rssFeedUrls: userDetails.assignedRssFeedUrls?.join(',\n') || "" });
      } else {
        toast({ variant: "destructive", title: "Error", description: "Could not fetch details for selected user." });
        setSelectedUserForFeeds(null);
        rssFeedsForm.reset({ rssFeedUrls: "" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch user details." });
    } finally {
      setIsLoadingUsers(false);
    }
  };
  
  // Admin: Save RSS feeds
  async function onSaveRssFeeds(data: RssFeedsFormValues) {
    if (!selectedUserForFeeds) {
      toast({ variant: "destructive", title: "No User Selected", description: "Please select a user to assign RSS feeds." });
      return;
    }
    setIsSavingRssFeeds(true);
    const urlsArray = data.rssFeedUrls ? data.rssFeedUrls.split(/[\n,]+/).map(url => url.trim()).filter(url => url !== "" && /^https?:\/\/.+/.test(url)) : [];
    
    const invalidUrls = data.rssFeedUrls ? data.rssFeedUrls.split(/[\n,]+/).map(url => url.trim()).filter(url => url !== "" && !/^https?:\/\/.+/.test(url)) : [];
    if (invalidUrls.length > 0) {
        toast({ variant: "destructive", title: "Invalid URLs", description: `Some URLs are invalid: ${invalidUrls.join(', ')}. Ensure http(s)://.` });
        setIsSavingRssFeeds(false);
        return;
    }

    try {
      const result = await updateUserRssFeedUrls(selectedUserForFeeds.id, urlsArray);
      if (result.success) {
        toast({ title: "RSS Feeds Updated", description: `RSS feeds for ${selectedUserForFeeds.name} saved.` });
        setSelectedUserForFeeds(prev => prev ? {...prev, assignedRssFeedUrls: urlsArray} : null);
        // If the updated user is the current user (admin editing their own feeds), update their view if it relies on currentUser directly.
        if (currentUser?.id === selectedUserForFeeds.id) {
          // For now, the user view fetches mentions directly, so this specific update isn't strictly needed for display.
        }
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.error || "Could not update." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsSavingRssFeeds(false);
    }
  }

  // User: Fetch their stored mentions on load
  const fetchUserMentions = useCallback(async () => {
    if (currentUser?.role === 'user' && currentUser.id) {
      setIsLoadingMentions(true);
      try {
        const mentions = await getGlobalMentionsForUser(currentUser.id);
        setUserMentions(mentions);
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to load your mentions." });
      } finally {
        setIsLoadingMentions(false);
      }
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (currentUser?.role === 'user' && !authLoading) {
      fetchUserMentions();
    }
  }, [currentUser, authLoading, fetchUserMentions]);

  const formatFeedTitle = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname.replace('www.', '')} Feed`;
    } catch {
      return 'RSS Feed';
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (currentUser?.role === 'admin') {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center">
              <Rss className="mr-3 h-6 w-6 text-primary" />
              Manage User RSS Feeds for Global Mentions
            </CardTitle>
            <CardDescription>
              Assign or update RSS feed URLs for users. These feeds will be used to populate their Global Mentions page. 
              Currently, parsing is simulated for demonstration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Label htmlFor="user-select" className="text-sm font-medium shrink-0">Select User:</Label>
              {isLoadingUsers && !selectedUserForFeeds ? (
                <div className="flex items-center text-sm text-muted-foreground w-full sm:w-[350px]">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users...
                </div>
              ) : (
                <Select 
                  value={selectedUserForFeeds?.id || ""} 
                  onValueChange={handleUserSelectionChange}
                  disabled={isLoadingUsers || isSavingRssFeeds}
                >
                  <SelectTrigger id="user-select" className="w-full sm:w-[350px] bg-background shadow-sm">
                    <SelectValue placeholder="-- Select a user --" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsersForAdmin.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedUserForFeeds && (
              <Form {...rssFeedsForm}>
                <form onSubmit={rssFeedsForm.handleSubmit(onSaveRssFeeds)} className="space-y-4 pt-4 border-t mt-4">
                  <h3 className="text-lg font-semibold text-muted-foreground">
                    RSS Feeds for: <span className="text-primary font-medium">{selectedUserForFeeds.name}</span>
                  </h3>
                   <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 flex items-start gap-2">
                    <Info className="h-5 w-5 shrink-0 mt-0.5"/>
                    <div>
                        Enter one RSS feed URL per line or separate them with commas.
                        Only valid URLs starting with http:// or https:// will be saved.
                    </div>
                  </div>
                  <FormField
                    control={rssFeedsForm.control}
                    name="rssFeedUrls"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned RSS Feed URLs</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., https://alerts.google.com/alerts/feeds/..."
                            rows={6}
                            {...field}
                            disabled={isSavingRssFeeds || isLoadingUsers}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isSavingRssFeeds || isLoadingUsers || !selectedUserForFeeds || !rssFeedsForm.formState.isDirty}>
                    {isSavingRssFeeds ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save RSS Feeds for {selectedUserForFeeds.name.split(' ')[0]}
                  </Button>
                </form>
              </Form>
            )}
             {!selectedUserForFeeds && !isLoadingUsers && (
                <div className="text-center py-10 text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-3" />
                    <p>Please select a user to manage their RSS feeds.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // User View: Display Mentions from RSS
  if (currentUser?.role === 'user') {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <div>
              <CardTitle className="text-xl font-headline flex items-center">
                <Globe className="mr-3 h-6 w-6 text-primary" />
                Your Global Mentions (from RSS Feeds)
              </CardTitle>
              <CardDescription>
                Mentions from your assigned RSS feeds will appear here automatically.
                {currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0 && 
                  ` Monitoring feeds for: "${currentUser.assignedKeywords.slice(0,2).join('", "')}${currentUser.assignedKeywords.length > 2 ? '"...' : '"'}`
                }
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingMentions && (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading your mentions...</p>
              </div>
            )}
            {!isLoadingMentions && (!currentUser.assignedRssFeedUrls || currentUser.assignedRssFeedUrls.length === 0) && (
               <div className="text-center py-10 text-muted-foreground">
                <SearchX className="mx-auto h-12 w-12 mb-3" />
                <p className="text-lg font-semibold">No RSS Feeds Assigned</p>
                <p>Please contact an administrator to assign RSS feeds to your account.</p>
              </div>
            )}
            {!isLoadingMentions && currentUser.assignedRssFeedUrls && currentUser.assignedRssFeedUrls.length > 0 && userMentions.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <Info className="mx-auto h-12 w-12 mb-3" />
                <p className="text-lg font-semibold">No Mentions Found Yet</p>
                <p>Mentions will appear here when they are found in your feeds.</p>
                <div className="mt-4">
                  <h3 className="text-md font-semibold mb-2">Your Assigned Feeds:</h3>
                  <ul className="list-none space-y-1 text-xs text-left max-w-md mx-auto">
                    {(currentUser.assignedRssFeedUrls || []).map((feedUrl, index) => (
                      <li key={index} className="flex items-center gap-2 p-1 border rounded-md bg-muted/30">
                        <Link className="h-3 w-3 text-primary flex-shrink-0" />
                        <span className="truncate" title={feedUrl}>
                          {formatFeedTitle(feedUrl)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {!isLoadingMentions && userMentions.length > 0 && (
              <div className="space-y-4">
                {currentUser?.assignedRssFeedUrls && currentUser.assignedRssFeedUrls.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700 flex items-start gap-2">
                    <Info className="h-5 w-5 shrink-0 mt-0.5 text-amber-600"/>
                    <div>
                      <strong>Developer Note:</strong> Monitoring {currentUser.assignedRssFeedUrls.length} RSS feed{currentUser.assignedRssFeedUrls.length > 1 ? 's' : ''}.
                      Assigned keywords: {currentUser.assignedKeywords?.join(', ') || 'none'}
                    </div>
                  </div>
                )}
                
                {/* Replace the flex container with this grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {userMentions.map((mention) => (
                    <div key={mention.id}>
                      {mention.platform === 'RSS Feed' ? (
                        <RssMentionCard mention={mention} />
                      ) : (
                        <GlobalMentionCard mention={mention} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <p className="text-muted-foreground">Content not available for your role.</p>
    </div>
  );
}
