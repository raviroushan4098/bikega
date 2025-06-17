
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { User, Mention } from '@/types'; // Mention might not be used directly for display in this iteration
import { getUsers, getUserById, updateUserRssFeedUrls } from '@/lib/user-service';
import { Globe, Rss, Save, Loader2, Info, FilterX, SearchCheck, SearchX as SearchXIcon, RefreshCw, Users as UsersIcon, Link as LinkIcon } from 'lucide-react'; // Added LinkIcon
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
// GlobalMentionCard might not be used directly in this iteration if no mentions are displayed
// import GlobalMentionCard from '@/components/dashboard/GlobalMentionCard';
// getGlobalMentionsForUser might not be used if we are not displaying parsed mentions yet
// import { getGlobalMentionsForUser } from '@/lib/global-mentions-service';
import { triggerGlobalMentionsRefresh } from './actions'; // Server Action

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

  // User state for their assigned RSS Feeds
  const [userAssignedRssFeeds, setUserAssignedRssFeeds] = useState<string[]>([]);
  const [isCheckingFeeds, setIsCheckingFeeds] = useState(false); // For the refresh button

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
        // If the updated user is the current user (admin editing their own feeds), update userAssignedRssFeeds
        if (currentUser?.id === selectedUserForFeeds.id) {
          setUserAssignedRssFeeds(urlsArray);
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

  // User: Fetch their assigned RSS feeds on load
  useEffect(() => {
    if (currentUser?.role === 'user' && !authLoading) {
      setUserAssignedRssFeeds(currentUser.assignedRssFeedUrls || []);
    }
  }, [currentUser, authLoading]);

  // User: Handle "Refresh" button for RSS feeds
  const handleCheckRssFeeds = async () => {
    if (!currentUser || !currentUser.id) return;
    setIsCheckingFeeds(true);
    toast({ title: "Checking RSS Feeds", description: "Connecting to backend... Full parsing coming soon."});
    try {
      const result = await triggerGlobalMentionsRefresh(currentUser.id);
      // The flow will return an informational message in 'errors' array
      if (result.errors && result.errors.length > 0) {
        toast({ title: "RSS Feed Status", description: result.errors.join('; ') });
      } else {
        toast({ title: "RSS Feed Check Complete", description: "Parsing and display of feed content is under development." });
      }
      // No need to re-fetch from Firestore here, as we are not yet storing parsed items from RSS.
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred while checking feeds." });
    } finally {
      setIsCheckingFeeds(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Admin View for assigning RSS Feeds (remains the same)
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
              Assign or update RSS feed URLs for users. These feeds will be used to populate their Global Mentions page once parsing is implemented.
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

  // User View: Display Assigned RSS Feeds and "Coming Soon" message
  if (currentUser?.role === 'user') {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-headline flex items-center">
                <Rss className="mr-3 h-6 w-6 text-primary" />
                Your Assigned RSS Feeds
              </CardTitle>
              <CardDescription>
                Content from these feeds will be displayed here soon.
                Assigned keywords for other sources: {currentUser.assignedKeywords && currentUser.assignedKeywords.length > 0 ? 
                  `"${currentUser.assignedKeywords.slice(0,3).join('", "')}${currentUser.assignedKeywords.length > 3 ? '"...' : '"'}` 
                  : " (None)"
                }
              </CardDescription>
            </div>
            <Button onClick={handleCheckRssFeeds} disabled={isCheckingFeeds} className="w-full sm:w-auto mt-2 sm:mt-0">
              {isCheckingFeeds ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Check Feeds Status
            </Button>
          </CardHeader>
          <CardContent>
            {isCheckingFeeds && !userAssignedRssFeeds.length && ( // Show loader only if checking and no feeds loaded yet
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Checking feed status...</p>
              </div>
            )}
            {!isCheckingFeeds && userAssignedRssFeeds.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <SearchXIcon className="mx-auto h-12 w-12 mb-3" />
                <p className="text-lg font-semibold">No RSS Feeds Assigned</p>
                <p>Please contact an administrator to assign RSS feeds to your account.</p>
              </div>
            )}
            {!isCheckingFeeds && userAssignedRssFeeds.length > 0 && (
              <div className="space-y-3">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700 flex items-start gap-2">
                    <Info className="h-5 w-5 shrink-0 mt-0.5 text-amber-600"/>
                    <div>
                        <strong>Feature Update:</strong> Displaying content from these RSS feeds is currently under development and will be available soon.
                        Below are the RSS feed URLs assigned to your account.
                    </div>
                </div>
                <h3 className="text-md font-semibold text-muted-foreground pt-2">Your Feeds:</h3>
                <ul className="list-none space-y-2 pl-0">
                  {userAssignedRssFeeds.map((feedUrl, index) => (
                    <li key={index} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30 hover:bg-muted/50">
                      <LinkIcon className="h-4 w-4 text-primary flex-shrink-0" />
                      <a 
                        href={feedUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-sm text-foreground hover:underline truncate"
                        title={feedUrl}
                      >
                        {feedUrl}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback for unexpected roles
  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <p className="text-muted-foreground">Content not available for your role.</p>
    </div>
  );
}

