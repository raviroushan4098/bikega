
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { User, Mention } from '@/types';
import { getUsers, getUserById, updateUserRssFeedUrls } from '@/lib/user-service';
import { Globe, Sparkles, Settings2, Users as UsersIcon, Rss, Save, Loader2, Info, FilterX, SearchCheck, SearchX as SearchXIcon, RefreshCw } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import GlobalMentionCard from '@/components/dashboard/GlobalMentionCard';
import { getGlobalMentionsForUser } from '@/lib/global-mentions-service';
import { triggerGlobalMentionsRefresh } from './actions'; // Server Action

const rssFeedsSchema = z.object({
  rssFeedUrls: z.string().optional(),
});
type RssFeedsFormValues = z.infer<typeof rssFeedsSchema>;

export default function GlobalMentionsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Admin state
  const [allUsersForAdmin, setAllUsersForAdmin] = useState<User[]>([]);
  const [selectedUserForFeeds, setSelectedUserForFeeds] = useState<User | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSavingRssFeeds, setIsSavingRssFeeds] = useState(false);

  const rssFeedsForm = useForm<RssFeedsFormValues>({
    resolver: zodResolver(rssFeedsSchema),
    defaultValues: { rssFeedUrls: "" },
  });

  // User state for mentions
  const [userMentions, setUserMentions] = useState<Mention[]>([]);
  const [isLoadingMentions, setIsLoadingMentions] = useState(false);
  const [isRefreshingMentions, setIsRefreshingMentions] = useState(false);

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
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.error || "Could not update." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsSavingRssFeeds(false);
    }
  }

  // User: Fetch stored mentions on load
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

  // User: Handle refresh mentions
  const handleRefreshMentions = async () => {
    if (!currentUser || !currentUser.id) return;
    setIsRefreshingMentions(true);
    toast({ title: "Refreshing Mentions", description: "Fetching latest data from all sources..."});
    try {
      const result = await triggerGlobalMentionsRefresh(currentUser.id);
      if (result.errors && result.errors.length > 0) {
        toast({ variant: "destructive", title: "Refresh Partially Failed", description: result.errors.join('; ') });
      } else {
        toast({ title: "Refresh Complete", description: `${result.newMentionsStored} new mentions stored.` });
      }
      await fetchUserMentions(); // Re-fetch from Firestore
    } catch (error) {
      toast({ variant: "destructive", title: "Refresh Error", description: "An unexpected error occurred while refreshing." });
    } finally {
      setIsRefreshingMentions(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Admin View for assigning RSS Feeds
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
                    <UsersIcon className="mx-auto h-12 w-12 mb-3" />
                    <p>Please select a user to manage their RSS feeds.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // User View: Display Global Mentions
  if (currentUser?.role === 'user') {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-headline flex items-center">
                <Globe className="mr-3 h-6 w-6 text-primary" />
                Your Global Mentions
              </CardTitle>
              <CardDescription>
                Mentions from Hacker News, GNews, and other web sources based on your keywords.
                {currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0 ? 
                  ` Keywords: "${currentUser.assignedKeywords.slice(0,3).join('", "')}${currentUser.assignedKeywords.length > 3 ? '"...' : '"'}` 
                  : " (No keywords assigned)"
                }
              </CardDescription>
            </div>
            <Button onClick={handleRefreshMentions} disabled={isLoadingMentions || isRefreshingMentions} className="w-full sm:w-auto mt-2 sm:mt-0">
              {isRefreshingMentions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh Mentions
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingMentions && !isRefreshingMentions && (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading your mentions...</p>
              </div>
            )}
            {!isLoadingMentions && userMentions.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <SearchXIcon className="mx-auto h-12 w-12 mb-3" />
                <p className="text-lg font-semibold">No Mentions Found</p>
                <p>
                  {currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0 ? 
                    "We couldn't find any mentions for your keywords yet." :
                    "You don't have any keywords assigned. Please contact an admin."
                  }
                </p>
                 {currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0 && (
                    <p className="text-sm mt-1">Try the "Refresh Mentions" button to fetch the latest data.</p>
                 )}
              </div>
            )}
            {!isLoadingMentions && userMentions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {userMentions.map(mention => (
                  <GlobalMentionCard key={mention.id} mention={mention} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback for unexpected roles or if somehow currentUser is null after auth check
  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <p className="text-muted-foreground">Content not available for your role.</p>
    </div>
  );
}
