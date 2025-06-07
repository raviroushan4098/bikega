
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { YouTubeMentionItem, User as AuthUserType } from '@/types';
import { getUsers, getUserById } from '@/lib/user-service';
import { searchYouTubeVideosByKeywords, getStoredYouTubeMentions, addYouTubeMentionsBatch } from '@/lib/youtube-video-service';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, ThumbsUp, MessageSquare, Video } from 'lucide-react'; // Added Video icon
import { useToast } from "@/hooks/use-toast";
import YouTubeMentionsCard from '@/components/dashboard/YouTubeMentionsCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import Link from 'next/link'; // Added Link for navigation

export default function YouTubeKeywordMentionsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [allUsersForAdmin, setAllUsersForAdmin] = useState<AuthUserType[]>([]);
  const [isLoadingAdminUsers, setIsLoadingAdminUsers] = useState<boolean>(false);
  const [selectedUserIdForMentionsFilter, setSelectedUserIdForMentionsFilter] = useState<string>('');

  const [youtubeMentions, setYoutubeMentions] = useState<YouTubeMentionItem[]>([]);
  const [isLoadingMentions, setIsLoadingMentions] = useState<boolean>(true);
  const [mentionsError, setMentionsError] = useState<string | null>(null);
  const [keywordsForMentions, setKeywordsForMentions] = useState<string[]>([]);

  // Fetch all users if current user is admin (for mentions filter dropdown)
  useEffect(() => {
    if (currentUser?.role === 'admin' && !authLoading) {
      setIsLoadingAdminUsers(true);
      getUsers()
        .then(setAllUsersForAdmin)
        .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to fetch user list for mentions filter." }))
        .finally(() => setIsLoadingAdminUsers(false));
    }
  }, [currentUser, authLoading, toast]);


  const loadMentionsFromFirestore = useCallback(async (userIdForMentions: string) => {
    setIsLoadingMentions(true);
    setMentionsError(null);
    try {
      const storedMentions = await getStoredYouTubeMentions(userIdForMentions);
      setYoutubeMentions(storedMentions);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load stored YouTube mentions.";
      setMentionsError(msg);
      setYoutubeMentions([]);
    } finally {
      setIsLoadingMentions(false);
    }
  }, []);

  const handleRefreshMentions = useCallback(async () => {
    let userIdToRefresh: string | undefined;
    let keywordsToSearch: string[] = [];

    if (currentUser?.role === 'user' && currentUser.id && currentUser.assignedKeywords) {
      userIdToRefresh = currentUser.id;
      keywordsToSearch = currentUser.assignedKeywords;
    } else if (currentUser?.role === 'admin' && selectedUserIdForMentionsFilter && selectedUserIdForMentionsFilter !== 'all_users_placeholder_for_mentions') {
      const selectedUser = allUsersForAdmin.find(u => u.id === selectedUserIdForMentionsFilter) || await getUserById(selectedUserIdForMentionsFilter);
      if (selectedUser && selectedUser.id && selectedUser.assignedKeywords) {
        userIdToRefresh = selectedUser.id;
        keywordsToSearch = selectedUser.assignedKeywords;
      }
    }
    
    setKeywordsForMentions(keywordsToSearch);

    if (!userIdToRefresh || keywordsToSearch.length === 0) {
      toast({ title: "Cannot Refresh", description: "No user selected or no keywords assigned for mentions search.", variant: "default" });
      setYoutubeMentions([]);
      setIsLoadingMentions(false);
      return;
    }

    setIsLoadingMentions(true);
    setMentionsError(null);
    toast({ title: "Refreshing YouTube Mentions...", description: `Searching for keywords: ${keywordsToSearch.join(', ')}` });

    try {
      const apiResult = await searchYouTubeVideosByKeywords(keywordsToSearch);
      if (apiResult.error) {
        setMentionsError(apiResult.error);
        toast({ title: "API Error", description: `Failed to fetch from YouTube API: ${apiResult.error}`, variant: "destructive" });
        setIsLoadingMentions(false); 
        return;
      }
      
      const apiMentions = apiResult.mentions;
      const storedMentions = await getStoredYouTubeMentions(userIdToRefresh);
      const storedMentionIds = new Set(storedMentions.map(m => m.id));
      
      const newMentionsToSave = apiMentions.filter(apiMention => !storedMentionIds.has(apiMention.id));

      if (newMentionsToSave.length > 0) {
        const newMentionsWithUserId = newMentionsToSave.map(m => ({ ...m, userId: userIdToRefresh! }));
        const saveResult = await addYouTubeMentionsBatch(userIdToRefresh, newMentionsWithUserId);
        if (saveResult.errorCount > 0) {
          toast({ title: "Save Error", description: `Failed to save some new mentions: ${saveResult.errors.join(', ')}`, variant: "destructive" });
        } else {
          toast({ title: "Mentions Updated", description: `${saveResult.successCount} new mentions saved.` });
        }
      } else {
        toast({ title: "No New Mentions", description: "No new YouTube mentions found for the given keywords." });
      }
      await loadMentionsFromFirestore(userIdToRefresh);

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to refresh YouTube mentions.";
      setMentionsError(msg);
      toast({ title: "Refresh Error", description: msg, variant: "destructive" });
    } finally {
      setIsLoadingMentions(false);
    }
  }, [currentUser, selectedUserIdForMentionsFilter, allUsersForAdmin, toast, loadMentionsFromFirestore]);

  // Effect for initial load of mentions and when selected user changes (for admin)
  useEffect(() => {
    let userIdForInitialLoad: string | undefined;
    let currentKeywords: string[] = [];

    if (currentUser?.role === 'user' && currentUser.id) {
      userIdForInitialLoad = currentUser.id;
      currentKeywords = currentUser.assignedKeywords || [];
    } else if (currentUser?.role === 'admin' && selectedUserIdForMentionsFilter && selectedUserIdForMentionsFilter !== 'all_users_placeholder_for_mentions') {
      userIdForInitialLoad = selectedUserIdForMentionsFilter;
      const user = allUsersForAdmin.find(u => u.id === selectedUserIdForMentionsFilter);
      currentKeywords = user?.assignedKeywords || [];
    }
    
    setKeywordsForMentions(currentKeywords);

    if (userIdForInitialLoad) {
      loadMentionsFromFirestore(userIdForInitialLoad);
    } else {
      setYoutubeMentions([]); 
      setIsLoadingMentions(false); 
    }
  }, [currentUser, selectedUserIdForMentionsFilter, allUsersForAdmin, loadMentionsFromFirestore]);

  const mentionsCardTitle = currentUser?.role === 'admin' && selectedUserIdForMentionsFilter !== 'all_users_placeholder_for_mentions' && selectedUserIdForMentionsFilter
    ? `Mentions for ${allUsersForAdmin.find(u => u.id === selectedUserIdForMentionsFilter)?.name || 'Selected User'}`
    : currentUser?.role === 'user' ? "Your YouTube Keyword Mentions"
    : "YouTube Keyword Mentions (Select a User)";


  if (authLoading) { 
    return (<div className="flex h-[calc(100vh-10rem)] items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>); 
  }

  return (
    <div className="space-y-6">
      {currentUser?.role === 'admin' && (
          <div className="mb-6 p-4 border rounded-md bg-card shadow-sm">
            <div className="flex items-center gap-3">
              <Label htmlFor="user-select-mentions-filter" className="text-sm font-medium shrink-0">Show mentions for user:</Label>
              {isLoadingAdminUsers ? (<div className="flex items-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users...</div>
              ) : (
                <Select value={selectedUserIdForMentionsFilter} onValueChange={(value) => setSelectedUserIdForMentionsFilter(value)}>
                  <SelectTrigger id="user-select-mentions-filter" className="w-full sm:w-[320px] bg-background">
                    <SelectValue placeholder="-- Select a user to view their mentions --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_users_placeholder_for_mentions" disabled>-- Select a user --</SelectItem>
                    {allUsersForAdmin.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>))} 
                  </SelectContent>
                </Select>
              )}
            </div>
             {(selectedUserIdForMentionsFilter && selectedUserIdForMentionsFilter !== 'all_users_placeholder_for_mentions' && keywordsForMentions.length === 0 && !isLoadingMentions) && (
                <p className="text-xs text-amber-600 mt-2">Note: The selected user has no keywords assigned. Mentions search will likely yield no results.</p>
            )}
          </div>
        )}

      <YouTubeMentionsCard
        title={mentionsCardTitle}
        mentions={youtubeMentions}
        isLoading={isLoadingMentions || (currentUser?.role === 'admin' && isLoadingAdminUsers)}
        error={mentionsError}
        onRefresh={handleRefreshMentions}
        keywordsUsed={keywordsForMentions}
      />
      
      <div className="mt-8 flex justify-center">
        <Link href="/dashboard/youtube/tracker" passHref>
          <Button variant="outline" size="lg">
            <Video className="mr-2 h-5 w-5" />
            Track Assigned Videos
          </Button>
        </Link>
      </div>
    </div>
  );
}
