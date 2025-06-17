
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { User } from '@/types';
import { getUsers, getUserById, updateUserRssFeedUrls } from '@/lib/user-service';
import { Globe, Sparkles, Settings2, Users as UsersIcon, Rss, Save, Loader2, Info } from 'lucide-react';
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

const rssFeedsSchema = z.object({
  rssFeedUrls: z.string().optional(),
});
type RssFeedsFormValues = z.infer<typeof rssFeedsSchema>;

export default function GlobalMentionsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [allUsersForAdmin, setAllUsersForAdmin] = useState<User[]>([]);
  const [selectedUserForFeeds, setSelectedUserForFeeds] = useState<User | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSavingRssFeeds, setIsSavingRssFeeds] = useState(false);

  const rssFeedsForm = useForm<RssFeedsFormValues>({
    resolver: zodResolver(rssFeedsSchema),
    defaultValues: { rssFeedUrls: "" },
  });

  useEffect(() => {
    if (currentUser?.role === 'admin' && !authLoading) {
      setIsLoadingUsers(true);
      getUsers()
        .then(setAllUsersForAdmin)
        .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to fetch user list." }))
        .finally(() => setIsLoadingUsers(false));
    }
  }, [currentUser, authLoading, toast]);

  const handleUserSelectionChange = async (userId: string) => {
    if (!userId) {
      setSelectedUserForFeeds(null);
      rssFeedsForm.reset({ rssFeedUrls: "" });
      return;
    }
    setIsLoadingUsers(true); // Indicate loading for selected user's data
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
  
  async function onSaveRssFeeds(data: RssFeedsFormValues) {
    if (!selectedUserForFeeds) {
      toast({ variant: "destructive", title: "No User Selected", description: "Please select a user to assign RSS feeds." });
      return;
    }
    setIsSavingRssFeeds(true);
    const urlsArray = data.rssFeedUrls ? data.rssFeedUrls.split(/[\n,]+/).map(url => url.trim()).filter(url => url !== "" && /^https?:\/\/.+/.test(url)) : [];
    
    // Validate URLs (basic check for http/https)
    const invalidUrls = data.rssFeedUrls ? data.rssFeedUrls.split(/[\n,]+/).map(url => url.trim()).filter(url => url !== "" && !/^https?:\/\/.+/.test(url)) : [];
    if (invalidUrls.length > 0) {
        toast({ variant: "destructive", title: "Invalid URLs", description: `Some URLs are invalid: ${invalidUrls.join(', ')}. Please ensure they start with http:// or https://.` });
        setIsSavingRssFeeds(false);
        return;
    }

    try {
      const result = await updateUserRssFeedUrls(selectedUserForFeeds.id, urlsArray);
      if (result.success) {
        toast({ title: "RSS Feeds Updated", description: `RSS feeds for ${selectedUserForFeeds.name} have been saved.` });
        // Optionally, update the local selectedUserForFeeds state if needed
        setSelectedUserForFeeds(prev => prev ? {...prev, assignedRssFeedUrls: urlsArray} : null);
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.error || "Could not update RSS feeds." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsSavingRssFeeds(false);
    }
  }

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

  // User View (Coming Soon)
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] p-4 sm:p-6 md:p-8 text-center">
      <Card className="w-full max-w-2xl shadow-2xl overflow-hidden border-primary/20">
        <CardHeader className="bg-gradient-to-br from-primary/5 via-background to-background p-8">
          <div className="flex justify-center items-center mb-6">
            <Globe className="h-16 w-16 text-primary animate-pulse" />
            <Sparkles className={cn("h-10 w-10 text-accent ml-2 opacity-75 animate-ping", "animation-delay-500")} />
          </div>
          <CardTitle className="text-3xl sm:text-4xl font-headline tracking-tight text-primary">
            Global Mentions Tracker - Coming Soon!
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            We're refining our Global Mentions feature to bring you even more comprehensive insights, including your assigned RSS feeds.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center space-y-3 text-muted-foreground">
            <Settings2 className="h-12 w-12 text-accent/80 mb-2 animate-spin animation-duration-3000" />
            <p className="text-base">
              Our enhanced Global Mentions Tracker is currently under development. Soon, you'll be able to monitor your keywords and RSS feeds across a wider range of news outlets, blogs, forums, and general web content.
            </p>
            <p className="text-sm">
              Thank you for your patience. We're excited to launch this upgrade!
            </p>
          </div>
          <Separator className="my-6" />
          <div className="text-xs text-muted-foreground/70">
            The current mock data and Hacker News integration will be supplemented with RSS feed integration.
          </div>
        </CardContent>
      </Card>
       <style jsx global>{`
        .animation-delay-500 {
          animation-delay: 0.5s;
        }
        .animation-duration-3000 {
            animation-duration: 3000ms;
        }
      `}</style>
    </div>
  );
}
