
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { YouTubeMentionItem, User as AuthUserType } from '@/types';
import { getUsers, getUserById } from '@/lib/user-service';
import { searchYouTubeVideosByKeywords, getStoredYouTubeMentions, addYouTubeMentionsBatch } from '@/lib/youtube-video-service';
import { Button } from '@/components/ui/button';
import { Loader2, Video, CalendarIcon, FilterX, SearchCheck } from 'lucide-react'; 
import { useToast } from "@/hooks/use-toast";
import YouTubeMentionsCard from '@/components/dashboard/YouTubeMentionsCard';
import YouTubeMentionsSummary from '@/components/dashboard/YouTubeMentionsSummary';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';


export default function YouTubeKeywordMentionsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [allUsersForAdmin, setAllUsersForAdmin] = useState<AuthUserType[]>([]);
  const [isLoadingAdminUsers, setIsLoadingAdminUsers] = useState<boolean>(false);
  const [selectedUserIdForMentionsFilter, setSelectedUserIdForMentionsFilter] = useState<string>('');

  const [youtubeMentions, setYoutubeMentions] = useState<YouTubeMentionItem[]>([]);
  const [filteredYoutubeMentions, setFilteredYoutubeMentions] = useState<YouTubeMentionItem[]>([]);
  const [isLoadingMentions, setIsLoadingMentions] = useState<boolean>(true);
  const [mentionsError, setMentionsError] = useState<string | null>(null);
  const [keywordsForMentions, setKeywordsForMentions] = useState<string[]>([]);
  const [lastRefreshTimestamp, setLastRefreshTimestamp] = useState<string | null>(null); // New state

  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (currentUser?.role === 'admin' && !authLoading) {
      setIsLoadingAdminUsers(true);
      getUsers()
        .then(setAllUsersForAdmin)
        .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to fetch user list for mentions filter." }))
        .finally(() => setIsLoadingAdminUsers(false));
    }
  }, [currentUser, authLoading, toast]);

  const applyFilters = useCallback((mentionsToFilter: YouTubeMentionItem[]) => {
    let filtered = [...mentionsToFilter];
    if (startDate) {
      const start = startOfDay(startDate);
      filtered = filtered.filter(mention => parseISO(mention.publishedAt) >= start);
    }
    if (endDate) {
      const end = endOfDay(endDate);
      filtered = filtered.filter(mention => parseISO(mention.publishedAt) <= end);
    }
    setFilteredYoutubeMentions(filtered);
    if (filtered.length === 0 && mentionsToFilter.length > 0 && (startDate || endDate)) {
        toast({ title: "No Results", description: "No YouTube mentions match the selected date range.", duration: 4000 });
    } else if (filtered.length > 0 && (startDate || endDate)) {
        toast({ title: "Filter Applied", description: `Showing ${filtered.length} mentions.`, duration: 3000 });
    }
  }, [startDate, endDate, toast]);

  const loadMentionsFromFirestore = useCallback(async (userIdForMentions: string) => {
    setIsLoadingMentions(true);
    setMentionsError(null);
    try {
      const storedMentions = await getStoredYouTubeMentions(userIdForMentions);
      setYoutubeMentions(storedMentions);
      applyFilters(storedMentions); 
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load stored YouTube mentions.";
      setMentionsError(msg);
      setYoutubeMentions([]);
      setFilteredYoutubeMentions([]);
    } finally {
      setIsLoadingMentions(false);
    }
  }, [applyFilters]);

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
      setFilteredYoutubeMentions([]);
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
      
      const newApiMentions = apiResult.mentions;
      const storedMentions = await getStoredYouTubeMentions(userIdToRefresh);
      const storedMentionIds = new Set(storedMentions.map(m => m.id));
      
      const newMentionsToSave = newApiMentions.filter(apiMention => !storedMentionIds.has(apiMention.id));

      if (newMentionsToSave.length > 0) {
        const newMentionsWithUserId = newMentionsToSave.map(m => ({ ...m, userId: userIdToRefresh! }));
        const saveResult = await addYouTubeMentionsBatch(userIdToRefresh, newMentionsWithUserId);
        if (saveResult.errorCount > 0) {
          toast({ title: "Save Error", description: `Failed to save some new mentions: ${saveResult.errors.join(', ')}`, variant: "destructive" });
        } else {
          toast({ title: "Mentions Updated", description: `${saveResult.successCount} new mentions saved.` });
        }
      } else {
        toast({ title: "No New Mentions", description: "No new YouTube mentions found to save." });
      }
      await loadMentionsFromFirestore(userIdToRefresh); 
      setLastRefreshTimestamp(new Date().toISOString()); // Set refresh timestamp

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to refresh YouTube mentions.";
      setMentionsError(msg);
      toast({ title: "Refresh Error", description: msg, variant: "destructive" });
    } finally {
      setIsLoadingMentions(false);
    }
  }, [currentUser, selectedUserIdForMentionsFilter, allUsersForAdmin, toast, loadMentionsFromFirestore]);

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
    
    setLastRefreshTimestamp(null); // Reset on user/filter change
    setKeywordsForMentions(currentKeywords);

    if (userIdForInitialLoad) {
      loadMentionsFromFirestore(userIdForInitialLoad);
    } else {
      setYoutubeMentions([]); 
      setFilteredYoutubeMentions([]);
      setIsLoadingMentions(false); 
    }
  }, [currentUser, selectedUserIdForMentionsFilter, allUsersForAdmin, loadMentionsFromFirestore]);

  const mentionsCardTitle = currentUser?.role === 'admin' && selectedUserIdForMentionsFilter !== 'all_users_placeholder_for_mentions' && selectedUserIdForMentionsFilter
    ? `Mentions for ${allUsersForAdmin.find(u => u.id === selectedUserIdForMentionsFilter)?.name || 'Selected User'}`
    : currentUser?.role === 'user' ? "Your YouTube Keyword Mentions"
    : "YouTube Keyword Mentions (Select a User)";

  const handleShowFilteredData = () => {
    applyFilters(youtubeMentions);
  };

  const handleResetFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setFilteredYoutubeMentions(youtubeMentions);
    toast({ title: "Filters Reset", description: "Showing all YouTube mentions.", duration: 3000 });
  };


  if (authLoading) { 
    return (<div className="flex h-[calc(100vh-10rem)] items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>); 
  }

  return (
    <div className="space-y-6">
      {currentUser?.role === 'admin' && (
          <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg font-headline">Admin Controls</CardTitle>
                <CardDescription>Select a user to view their YouTube keyword mentions.</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}

      <Card className="shadow-sm">
        <CardHeader>
            <CardTitle className="text-lg font-headline">Filter Mentions by Date</CardTitle>
            <CardDescription>Select a date range to filter the YouTube mentions shown below.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-6 p-4 border rounded-md bg-background/50 space-y-4 md:space-y-0 md:flex md:flex-wrap md:items-end md:justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto md:flex-grow">
                    <div className="space-y-1.5 flex-1 min-w-[180px]">
                        <Label htmlFor="start-date">From Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="start-date"
                                variant={"outline"}
                                className={cn(
                                "w-full justify-start text-left font-normal",
                                !startDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={startDate}
                                onSelect={setStartDate}
                                initialFocus
                                disabled={(date) => (endDate ? date > endDate : false) || date > new Date()}
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-[180px]">
                        <Label htmlFor="end-date">To Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="end-date"
                                variant={"outline"}
                                className={cn(
                                "w-full justify-start text-left font-normal",
                                !endDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={endDate}
                                onSelect={setEndDate}
                                initialFocus
                                disabled={(date) => (startDate ? date < startDate : false) || date > new Date()}
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2 md:pt-0 md:items-end shrink-0">
                    <Button onClick={handleShowFilteredData} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                        <SearchCheck className="mr-2 h-4 w-4" />
                        Show Results
                    </Button>
                    <Button onClick={handleResetFilters} variant="destructive" className="w-full sm:w-auto">
                        <FilterX className="mr-2 h-4 w-4" />
                        Reset Filters
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>


      {(!isLoadingMentions && !mentionsError && filteredYoutubeMentions.length > 0) && (
        <YouTubeMentionsSummary mentions={filteredYoutubeMentions} />
      )}

      <YouTubeMentionsCard
        title={mentionsCardTitle}
        mentions={filteredYoutubeMentions}
        isLoading={isLoadingMentions || (currentUser?.role === 'admin' && isLoadingAdminUsers)}
        error={mentionsError}
        onRefresh={handleRefreshMentions}
        keywordsUsed={keywordsForMentions}
        lastRefreshTimestamp={lastRefreshTimestamp} 
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

