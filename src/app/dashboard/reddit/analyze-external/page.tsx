"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UserSearch, Upload, FileText, BarChart3, MessageSquare, ChevronsUpDown, Download, RefreshCw, Database, ListTree, Info, AlertTriangle, Clock, UserX as UserXIcon, Trash2, CalendarIcon, FilterX, SearchCheck, InfoIcon, Hourglass, DatabaseZap, ListChecks, Users, MessagesSquare, TrendingUp, MessageCircleReply, Sheet, PieChart as PieChartIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { analyzeExternalRedditUser, type ExternalRedditUserAnalysis, type ExternalRedditUserDataItem } from '@/ai/flows/analyze-external-reddit-user-flow';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, formatDistanceToNow, startOfDay, endOfDay, formatDistanceToNowStrict } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from '@/components/ui/separator';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getStoredRedditAnalyses, addOrUpdateRedditUserPlaceholder, deleteStoredRedditAnalysis } from '@/lib/reddit-api-service';
import type { ColumnConfig } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import StatCard from '@/components/dashboard/StatCard';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Sector, LabelList } from 'recharts';
import ReactDOM from 'react-dom/client';

import { db } from '@/lib/firebase';

interface AnalysisResultDisplay {
  username: string;
  data?: ExternalRedditUserAnalysis;
  error?: string; 
  isLoading: boolean;
  isRefreshing?: boolean;
}

const RedditAnalysisCardSkeleton: React.FC = () => (
  <Card className="shadow-md border border-border/70 opacity-70">
    <CardHeader className="bg-muted/20 rounded-t-lg p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-3/5" /> 
        <Skeleton className="h-8 w-20" /> 
      </div>
      <Skeleton className="h-4 w-1/2 mt-1" />
    </CardHeader>
    <CardContent className="p-4 md:p-6 space-y-4">
      <Card className="bg-background/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <Skeleton className="h-5 w-1/3" />
        </CardHeader>
        <CardContent className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Accordion type="single" collapsible className="w-full" defaultValue={'items-skeleton'}>
        <AccordionItem value="items-skeleton">
          <AccordionTrigger className="text-base font-medium hover:no-underline">
            <Skeleton className="h-6 w-1/3" />
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 mt-2">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </CardContent>
    <CardFooter className="p-4 bg-muted/20 rounded-b-lg justify-end">
      <Skeleton className="h-4 w-1/4" />
    </CardFooter>
  </Card>
);

const formatStatNumber = (num: number): string => {
  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

const DailyActivityChart = ({ data, width = 600, height = 300 }: { data: { date: string; posts: number; comments: number }[], width?: number, height?: number }) => (
  <div style={{ width, height, backgroundColor: 'white', padding: '10px', fontFamily: 'Inter, sans-serif' }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" angle={-30} textAnchor="end" height={50} tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
        <RechartsTooltip contentStyle={{ fontSize: '12px' }} />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
        <Line type="monotone" dataKey="posts" stroke="#29ABE2" strokeWidth={2} name="Posts" dot={{ r: 2 }} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="comments" stroke="#77DDE7" strokeWidth={2} name="Comments" dot={{ r: 2 }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const SubredditActivityChart = ({ data, width = 600, height = 700 }: { data: { subreddit: string; posts: number; comments: number }[], width?: number, height?: number }) => {
  // Calculate max value and round up to nearest 10
  const maxValue = Math.max(
    ...data.map(item => Math.max(item.posts, item.comments))
  );
  const yAxisMax = Math.ceil(maxValue / 10) * 10;

  return (
    <div style={{ width, height, backgroundColor: 'white', padding: '10px', fontFamily: 'Inter, sans-serif' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={data} 
          margin={{ top: 20, right: 30, left: 20, bottom: 90 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="subreddit" 
            angle={-45} 
            textAnchor="end" 
            interval={0} 
            tick={{ fontSize: 10 }}
            height={80}
          />
          <YAxis 
            allowDecimals={false}
            domain={[0, yAxisMax]}
            ticks={Array.from({ length: (yAxisMax / 10) + 1 }, (_, i) => i * 10)}
            tick={{ fontSize: 10 }}
          />
          <RechartsTooltip contentStyle={{ fontSize: '12px' }} />
          <Legend 
            wrapperStyle={{ 
              fontSize: '12px', 
              paddingTop: '20px',
              bottom: -5
            }} 
          />
          <Bar dataKey="posts" fill="#29ABE2" name="Posts">
            <LabelList 
              dataKey="posts" 
              position="top" 
              style={{ fontSize: '8px', fill: '#333' }} 
              formatter={(value: number) => value > 0 ? value : ''}
              //offset={7}
            />
          </Bar>
          <Bar dataKey="comments" fill="#77DDE7" name="Comments">
            <LabelList 
              dataKey="comments" 
              position="top" 
              style={{ fontSize: '8px', fill: '#333' }} 
              formatter={(value: number) => value > 0 ? value : ''}
              //offset={7}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const SentimentPieChart = ({ data, width = 400, height = 250 }: { data: { name: string; value: number }[], width?: number, height?: number }) => {
  const COLORS = {
    Positive: '#22c55e', 
    Negative: '#ef4444', 
    Neutral: '#64748b',  
    Unknown: '#a1a1aa'  
  };

  return (
    <div style={{ width, height, backgroundColor: 'white', padding: '10px', fontFamily: 'Inter, sans-serif' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            isAnimationActive={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#CCCCCC'} />
            ))}
          </Pie>
          <RechartsTooltip contentStyle={{ fontSize: '12px' }} />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};


const renderChartToImage = async (ChartComponent: React.FC<any>, chartData: any, chartProps?: {width?:number, height?:number}): Promise<string | null> => {
  const chartContainer = document.createElement('div');
  chartContainer.style.position = 'fixed';
  chartContainer.style.left = '-9999px'; 
  chartContainer.style.top = '-9999px';
  chartContainer.style.width = `${chartProps?.width || 600}px`; 
  chartContainer.style.height = `${chartProps?.height || 300}px`;
  document.body.appendChild(chartContainer);

  const root = ReactDOM.createRoot(chartContainer);
  
  return new Promise((resolve) => {
    root.render(React.createElement(ChartComponent, { data: chartData, ...chartProps }));
    
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(chartContainer.firstChild as HTMLElement, {
          scale: 1.5, 
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png');
        resolve(imgData);
      } catch (e) {
        console.error("Error generating chart image with html2canvas:", e);
        resolve(null);
      } finally {
        root.unmount();
        if (document.body.contains(chartContainer)) {
            document.body.removeChild(chartContainer);
        }
      }
    }, 1500); 
  });
};


export default function AnalyzeExternalRedditUserPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [singleUsername, setSingleUsername] = useState<string>('');
  const [analysisResults, setAnalysisResults] = useState<AnalysisResultDisplay[]>([]);
  const [isProcessingCsv, setIsProcessingCsv] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoadingStoredData, setIsLoadingStoredData] = useState<boolean>(true);
  const [isUpdatingAll, setIsUpdatingAll] = useState<boolean>(false);

  const [isUserListDialogOpen, setIsUserListDialogOpen] = useState(false);
  const [savedUsernamesForDialog, setSavedUsernamesForDialog] = useState<string[]>([]);
  const [isLoadingUserListDialog, setIsLoadingUserListDialog] = useState(false);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);


  const fetchAndSetStoredAnalyses = useCallback(async () => {
      if (currentUser?.id) {
          setIsLoadingStoredData(true);
          try {
              const storedData = await getStoredRedditAnalyses(currentUser.id);
              const displayableResults: AnalysisResultDisplay[] = storedData.map(data => ({
                  username: data.username,
                  data: data, 
                  isLoading: false,
                  isRefreshing: false,
                  error: data.error, 
              }));
              setAnalysisResults(displayableResults);
          } catch (error) {
              console.error("Error fetching stored Reddit analyses:", error);
              toast({ variant: "destructive", title: "Load Error", description: "Failed to load stored analyses." });
              setAnalysisResults([]);
          } finally {
              setIsLoadingStoredData(false);
          }
      } else {
          setAnalysisResults([]);
          setIsLoadingStoredData(false); 
      }
  }, [currentUser, toast]);

  useEffect(() => {
    if (!authLoading && currentUser) { 
        fetchAndSetStoredAnalyses();
    }
  }, [currentUser, authLoading, fetchAndSetStoredAnalyses]);


  const processSingleUsername = async (usernameToAnalyze: string, isRefreshOp: boolean = false, appUserIdForCall: string) => {
    setAnalysisResults(prevResults => {
      const currentEntry = prevResults.find(r => r.username === usernameToAnalyze);
      const isFirstTimeAnalysis = !currentEntry?.data || currentEntry.data._placeholder === true;

      return prevResults.map(r => {
        if (r.username === usernameToAnalyze) {
          return {
            ...r,
            isLoading: isFirstTimeAnalysis && !isRefreshOp,
            isRefreshing: isRefreshOp || (!isFirstTimeAnalysis && !currentEntry?.data?.lastRefreshedAt),
            error: undefined,
            data: r.data ? { ...r.data, error: undefined, _placeholder: false } : undefined,
          };
        }
        return r;
      });
    });

    try {
      const resultFromFlow = await analyzeExternalRedditUser({ username: usernameToAnalyze, appUserId: appUserIdForCall });

      if (resultFromFlow.error) {
        const errorMessage = resultFromFlow.error;
        const isSuspendedAccount = errorMessage.toLowerCase().includes('suspended');

        // Update UI with error state
        setAnalysisResults(prev => prev.map(r =>
          r.username === usernameToAnalyze ? {
            username: usernameToAnalyze,
            error: errorMessage,
            isLoading: false,
            isRefreshing: false,
            data: r.data ? { ...r.data, error: errorMessage } : undefined
          } : r
        ));

        // Only show toast for non-updating-all operations
        if (!isUpdatingAll) {
          toast({
            variant: "destructive",
            title: `Analysis Failed for u/${usernameToAnalyze}`,
            description: errorMessage,
            duration: 7000
          });
        }

        // Update Firestore with suspension status
        try {
          const docRef = doc(db, `ExternalRedditUser/${appUserIdForCall}/analyzedRedditProfiles/${usernameToAnalyze}`);
          await setDoc(docRef, {
            username: usernameToAnalyze,
            suspensionStatus: isSuspendedAccount ? "This account has been suspended" : "Account inaccessible",
            lastError: errorMessage,
            lastErrorAt: new Date().toISOString(),
            _placeholder: false,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          console.log(`Updated Firestore with error status for u/${usernameToAnalyze}`);
        } catch (dbError) {
          console.error(`Failed to update Firestore for user ${usernameToAnalyze} with error status:`, dbError);
          toast({ 
            variant: "destructive", 
            title: "Database Update Failed", 
            description: "Failed to save error status to database." 
          });
        }
      } else {
        // Success case - update UI with analysis results
        setAnalysisResults(prev => prev.map(r => 
          r.username === usernameToAnalyze ? {
            username: usernameToAnalyze,
            data: { ...resultFromFlow, _placeholder: false },
            isLoading: false,
            isRefreshing: false,
            error: undefined
          } : r
        ));

        // Add this Firestore update for successful analysis
        try {
          const docRef = doc(db, `ExternalRedditUser/${appUserIdForCall}/analyzedRedditProfiles/${usernameToAnalyze}`);
          await setDoc(docRef, {
            ...resultFromFlow,
            _placeholder: false,
            updatedAt: new Date().toISOString(),
            lastRefreshedAt: new Date().toISOString()
          }, { merge: true });

          console.log(`Successfully updated Firestore data for u/${usernameToAnalyze}`);
        } catch (dbError) {
          console.error(`Failed to update Firestore for user ${usernameToAnalyze}:`, dbError);
          toast({ 
            variant: "destructive", 
            title: "Database Update Failed", 
            description: "Analysis completed but failed to save to database." 
          });
        }

        if (!isUpdatingAll && isRefreshOp) {
          toast({ title: `Refreshed u/${usernameToAnalyze}`, description: "Data updated successfully." });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during analysis.";
      console.error(`[Client] Error analyzing user ${usernameToAnalyze}:`, error);

      // Update UI with error state
      setAnalysisResults(prev => prev.map(r =>
        r.username === usernameToAnalyze ? {
          username: usernameToAnalyze,
          error: errorMessage,
          isLoading: false,
          isRefreshing: false,
          data: r.data ? { ...r.data, error: errorMessage } : undefined
        } : r
      ));

      // Only show toast for non-updating-all operations
      if (!isUpdatingAll) {
        toast({
          variant: "destructive",
          title: `Analysis Failed for u/${usernameToAnalyze}`,
          description: errorMessage,
          duration: 7000
        });
      }

      // Update Firestore with error status
      try {
        await setDoc(doc(db, `users/${appUserIdForCall}/redditAnalyses`, usernameToAnalyze), {
          suspensionStatus: "Analysis error occurred",
          lastError: errorMessage,
          lastErrorAt: new Date().toISOString()
        }, { merge: true });
      } catch (dbError) {
        console.error(`Failed to update Firestore for user ${usernameToAnalyze} with error status:`, dbError);
      }
    }
  };
  
  const handleAnalyzeSingleUser = async () => {
    const trimmedUsername = singleUsername.trim().replace(/^u\//i, '');
    if (!trimmedUsername) {
      toast({ variant: "destructive", title: "Input Error", description: "Please enter a Reddit username." });
      return;
    }
    if (!currentUser?.id) {
      toast({ variant: "destructive", title: "Authentication Error", description: "Current user not found." });
      return;
    }
    
    const existingUserDisplayIndex = analysisResults.findIndex(r => r.username === trimmedUsername);

    if (existingUserDisplayIndex === -1) {
      const placeholderResult = await addOrUpdateRedditUserPlaceholder(currentUser.id, trimmedUsername);
      if ('error' in placeholderResult) {
        toast({ variant: "destructive", title: "Registration Error", description: placeholderResult.error });
        return;
      }
      
      setAnalysisResults(prev => {
        // Create the new result
        const newResult = { 
          username: trimmedUsername, 
          isLoading: true, 
          isRefreshing: false, 
          error: undefined, 
          data: { 
            username: trimmedUsername,
            _placeholder: true,
            lastRefreshedAt: null,
            accountCreated: null,
            totalPostKarma: 0,
            totalCommentKarma: 0,
            subredditsPostedIn: [],
            totalPostsFetchedThisRun: 0,
            totalCommentsFetchedThisRun: 0,
            fetchedPostsDetails: [],
            fetchedCommentsDetails: [],
          }
        };

        // Sort all results including the new one
        return [...(prev || []), newResult].sort((a, b) => 
          (a?.username || '').localeCompare(b?.username || '')
        );
      });

      await processSingleUsername(trimmedUsername, false, currentUser.id);
    } else {
      await processSingleUsername(trimmedUsername, true, currentUser.id);
    }
    setSingleUsername(''); 
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser?.id) return;

    // Validate file type and extension
    if (!file.type.match('text/csv|application/vnd.ms-excel') && !file.name.toLowerCase().endsWith('.csv')) {
      toast({ 
        variant: "destructive", 
        title: "Invalid File", 
        description: "Please upload a valid CSV file." 
      });
      event.target.value = '';
      setFileName(null);
      return;
    }

    setFileName(file.name);
    setIsProcessingCsv(true);

    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });

      // Split lines and handle different line endings
      const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim());
      
      // Check if first line is header and remove it
      const firstLine = lines[0].toLowerCase();
      const dataLines = firstLine.includes('user_name') || firstLine.includes('username') 
        ? lines.slice(1) 
        : lines;

      // Extract and clean usernames
      const usernames = dataLines
        .map(line => line.split(',')[0]) // Take first column
        .map(username => username.trim().replace(/^u\//i, ''))
        .filter(username => username && username.length > 0);

      if (usernames.length === 0) {
        toast({ 
          variant: "destructive", 
          title: "No Usernames Found", 
          description: "CSV file appears to be empty or contains no valid usernames." 
        });
        return;
      }

      // Process unique usernames
      const uniqueUsernames = [...new Set(usernames)];
      for (const username of uniqueUsernames) {
        const result = await addOrUpdateRedditUserPlaceholder(currentUser.id, username);
        if ('error' in result) {
          console.error(`Failed to process username: ${username}`, result.error);
        }
      }

      toast({ 
        title: "CSV Processing Complete", 
        description: `Successfully processed ${uniqueUsernames.length} unique usernames.` 
      });

      await fetchAndSetStoredAnalyses();

    } catch (error) {
      console.error('CSV processing error:', error);
      toast({ 
        variant: "destructive", 
        title: "CSV Processing Failed", 
        description: "Failed to read or process the CSV file." 
      });
    } finally {
      setIsProcessingCsv(false);
      event.target.value = '';
      setFileName(null);
    }
  };

  const handleRefreshAnalysis = async (username: string) => {
    if (!currentUser?.id) return;
    await processSingleUsername(username, true, currentUser.id);
  };

  const handleUpdateAll = async () => {
    if (!currentUser?.id || analysisResults.length === 0) {
        toast({ title: "Nothing to Update", description: "No profiles loaded to update.", duration: 3000 });
        return;
    }
    setIsUpdatingAll(true);
    toast({ title: "Updating All Profiles", description: `Starting analysis/refresh for ${analysisResults.length} profiles. This may take some time.`, duration: 5000 });
    
    const usernamesToProcess = analysisResults.map(r => r.username);

    for (const username of usernamesToProcess) {
        await processSingleUsername(username, true, currentUser.id);
    }

    setIsUpdatingAll(false);
    toast({ title: "Update All Complete", description: "All displayed profiles have been processed." });
  };

  const handleDownloadTemplate = () => {
    const csvContent = "USER_NAME\n"; 
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { 
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "reddit_username_template.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleOpenUserListDialog = async () => {
    if (!currentUser?.id) {
        toast({ variant: "destructive", title: "Error", description: "Cannot fetch list: User not authenticated." });
        return;
    }
    setIsUserListDialogOpen(true);
    setIsLoadingUserListDialog(true);
    setSavedUsernamesForDialog([]);
    try {
        const storedAnalyses = await getStoredRedditAnalyses(currentUser.id);
        const usernames = storedAnalyses.map(analysis => analysis.username).sort();
        setSavedUsernamesForDialog(usernames);
    } catch (error) {
        console.error("Error fetching usernames for dialog:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to fetch list of saved usernames." });
    } finally {
        setIsLoadingUserListDialog(false);
    }
  };

  const handleDeleteUserAnalysis = (username: string) => {
    setUserToDelete(username);
    setIsConfirmDeleteDialogOpen(true); // Make sure this matches
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete || !currentUser?.id) return;

    setIsDeletingUser(true);
    const result = await deleteStoredRedditAnalysis(currentUser.id, userToDelete);
    setIsDeletingUser(false);
    setIsConfirmDeleteDialogOpen(false);

    if (result.success) {
      toast({ title: "Deletion Successful", description: `Analysis data for u/${userToDelete} has been removed.` });
      setAnalysisResults(prev => prev.filter(r => r.username !== userToDelete));
      setSavedUsernamesForDialog(prev => prev.filter(name => name !== userToDelete));
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.error || "Could not remove user analysis." });
    }
    setUserToDelete(null);
  };

  const handleResetFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    toast({ title: "Date Filters Reset", description: "Displaying all posts/comments within profiles.", duration: 3000 });
  };
  
  const currentDisplayResults = useMemo(() => {
    return analysisResults.filter(r => r.data && !r.data._placeholder && !r.data.error);
  }, [analysisResults]);


  const summaryStats = useMemo(() => {
    const initialStats = {
      totalUsernames: currentDisplayResults?.length || 0,
      totalPosts: 0,
      totalComments: 0,
      totalScore: 0,
      totalReplies: 0,
      blockedAccounts: analysisResults.filter(r => 
        r.data?.suspensionStatus || r.data?.error || r.error
      ).length || 0
    };

    if (!Array.isArray(currentDisplayResults)) {
      return initialStats;
    }

    return currentDisplayResults.reduce((stats, result) => {
      // Skip if data is undefined or is a placeholder
      if (!result?.data || result.data._placeholder) {
        return stats;
      }

      // Filter and process posts within date range
      const filteredPosts = result.data.fetchedPostsDetails.filter(post => {
        const postDate = parseISO(post.timestamp);
        if (!startDate && !endDate) return true;
        let inRange = true;
        if (startDate) inRange = inRange && (postDate >= startOfDay(startDate));
        if (endDate) inRange = inRange && (postDate <= endOfDay(endDate));
        return inRange;
      });

      // Filter and process comments within date range
      const filteredComments = result.data.fetchedCommentsDetails.filter(comment => {
        const commentDate = parseISO(comment.timestamp);
        if (!startDate && !endDate) return true;
        let inRange = true;
        if (startDate) inRange = inRange && (commentDate >= startOfDay(startDate));
        if (endDate) inRange = inRange && (commentDate <= endOfDay(endDate));
        return inRange;
      });

      // Calculate stats from filtered data
      filteredPosts.forEach(post => {
        if (post) {
          stats.totalPosts++;
          stats.totalScore += post.score || 0;
          stats.totalReplies += post.numComments || 0;
        }
      });

      filteredComments.forEach(comment => {
        if (comment) {
          stats.totalComments++;
          stats.totalScore += comment.score || 0;
        }
      });

      return stats;
    }, initialStats);

  }, [currentDisplayResults, analysisResults, startDate, endDate]);


  const prepareDailyChartData = (results: AnalysisResultDisplay[]) => {
    const dailyActivity: { [key: string]: { posts: number; comments: number } } = {};
    
    results.forEach(result => {
      if (!result.data || result.data._placeholder || result.data.error) return;

      // Filter posts by date range
      result.data.fetchedPostsDetails
        .filter(post => {
          const postDate = parseISO(post.timestamp);
          if (!startDate && !endDate) return true;
          let inRange = true;
          if (startDate) inRange = inRange && (postDate >= startOfDay(startDate));
          if (endDate) inRange = inRange && (postDate <= endOfDay(endDate));
          return inRange;
        })
        .forEach(post => {
          const date = format(parseISO(post.timestamp), 'yyyy-MM-dd');
          if (!dailyActivity[date]) {
            dailyActivity[date] = { posts: 0, comments: 0 };
          }
          dailyActivity[date].posts++;
        });

      // Filter comments by date range
      result.data.fetchedCommentsDetails
        .filter(comment => {
          const commentDate = parseISO(comment.timestamp);
          if (!startDate && !endDate) return true;
          let inRange = true;
          if (startDate) inRange = inRange && (commentDate >= startOfDay(startDate));
          if (endDate) inRange = inRange && (commentDate <= endOfDay(endDate));
          return inRange;
        })
        .forEach(comment => {
          const date = format(parseISO(comment.timestamp), 'yyyy-MM-dd');
          if (!dailyActivity[date]) {
            dailyActivity[date] = { posts: 0, comments: 0 };
          }
          dailyActivity[date].comments++;
        });
    });

    return Object.entries(dailyActivity)
      .map(([date, data]) => ({
        date: format(parseISO(date), 'MMM dd'),
        posts: data.posts,
        comments: data.comments
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const prepareSubredditChartData = (results: AnalysisResultDisplay[]) => {
    const subredditActivity: { [key: string]: { posts: number; comments: number } } = {};
    
    results.forEach(result => {
      if (!result.data || result.data._placeholder || result.data.error) return;

      // Filter posts by date range
      result.data.fetchedPostsDetails
        .filter(post => {
          const postDate = parseISO(post.timestamp);
          if (!startDate && !endDate) return true;
          let inRange = true;
          if (startDate) inRange = inRange && (postDate >= startOfDay(startDate));
          if (endDate) inRange = inRange && (postDate <= endOfDay(endDate));
          return inRange;
        })
        .forEach(post => {
          if (!subredditActivity[post.subreddit]) {
            subredditActivity[post.subreddit] = { posts: 0, comments: 0 };
          }
          subredditActivity[post.subreddit].posts++;
        });

      // Filter comments by date range
      result.data.fetchedCommentsDetails
        .filter(comment => {
          const commentDate = parseISO(comment.timestamp);
          if (!startDate && !endDate) return true;
          let inRange = true;
          if (startDate) inRange = inRange && (commentDate >= startOfDay(startDate));
          if (endDate) inRange = inRange && (commentDate <= endOfDay(endDate));
          return inRange;
        })
        .forEach(comment => {
          if (!subredditActivity[comment.subreddit]) {
            subredditActivity[comment.subreddit] = { posts: 0, comments: 0 };
          }
          subredditActivity[comment.subreddit].comments++;
        });
    });

    return Object.entries(subredditActivity)
      .map(([subreddit, data]) => ({
        subreddit,
        posts: data.posts,
        comments: data.comments
      }))
      .sort((a, b) => ((b.posts + b.comments) - (a.posts + a.comments)))
      .slice(0, 10); // Get top 10 most active subreddits
  };

  const prepareUserActivityChartData = (results: AnalysisResultDisplay[]) => {
    return results
      .filter(result => result.data && !result.data._placeholder && !result.data.error)
      .map(result => ({
        username: `u/${result.data!.username}`,
        posts: result.data!.fetchedPostsDetails
          .filter(post => {
            const postDate = parseISO(post.timestamp);
            if (!startDate && !endDate) return true;
            let inRange = true;
            if (startDate) inRange = inRange && (postDate >= startOfDay(startDate));
            if (endDate) inRange = inRange && (postDate <= endOfDay(endDate));
            return inRange;
          }).length,
        comments: result.data!.fetchedCommentsDetails
          .filter(comment => {
            const commentDate = parseISO(comment.timestamp);
            if (!startDate && !endDate) return true;
            let inRange = true;
            if (startDate) inRange = inRange && (commentDate >= startOfDay(startDate));
            if (endDate) inRange = inRange && (commentDate <= endOfDay(endDate));
            return inRange;
          }).length
      }))
      .sort((a, b) => (b.posts + b.comments) - (a.posts + a.comments));
  };

  const UserActivityChart = ({ data, width = 600, height = 400 }: { 
    data: { username: string; posts: number; comments: number }[],
    width?: number,
    height?: number 
  }) => {
    const maxValue = Math.max(...data.map(item => Math.max(item.posts, item.comments)));
    const yAxisMax = Math.ceil(maxValue / 10) * 10;

    return (
      <div style={{ width, height, backgroundColor: 'white', padding: '10px', fontFamily: 'Inter, sans-serif' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            margin={{ top: 20, right: 30, left: 20, bottom: 90 }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, yAxisMax]} />
            <YAxis 
              type="category" 
              dataKey="username" 
              width={100}
              tick={{ fontSize: 10 }}
            />
            <RechartsTooltip contentStyle={{ fontSize: '12px' }} />
            <Legend 
              wrapperStyle={{ 
                fontSize: '12px',
                paddingTop: '20px'
              }}
            />
            <Bar dataKey="posts" fill="#29ABE2" name="Posts">
              <LabelList 
                dataKey="posts" 
                position="right"
                style={{ fontSize: '8px', fill: '#333' }}
                formatter={(value: number) => value > 0 ? value : ''}
              />
            </Bar>
            <Bar dataKey="comments" fill="#77DDE7" name="Comments">
              <LabelList 
                dataKey="comments" 
                position="right"
                style={{ fontSize: '8px', fill: '#333' }}
                formatter={(value: number) => value > 0 ? value : ''}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const UserSubredditActivityChart = ({ data, width = 800, height = 500 }: {
    data: AnalysisResultDisplay[],
    width?: number,
    height?: number
  }) => {
    // Prepare data for grouped bar chart
    const chartData = data.reduce((acc: any[], result) => {
      if (!result.data || result.data._placeholder || result.data.error) return acc;
      
      const processActivities = (activities: any[], type: 'posts' | 'comments') => {
        return activities
          .filter(item => {
            const itemDate = parseISO(item.timestamp);
            if (!startDate && !endDate) return true;
            let inRange = true;
            if (startDate) inRange = inRange && (itemDate >= startOfDay(startDate));
            if (endDate) inRange = inRange && (itemDate <= endOfDay(endDate));
            return inRange;
          })
          .reduce((subredditCounts: { [key: string]: number }, item) => {
            subredditCounts[item.subreddit] = (subredditCounts[item.subreddit] || 0) + 1;
            return subredditCounts;
          }, {});
      };

      const postCounts = processActivities(result.data.fetchedPostsDetails, 'posts');
      const commentCounts = processActivities(result.data.fetchedCommentsDetails, 'comments');

      // Combine all subreddits
      const allSubreddits = new Set([
        ...Object.keys(postCounts),
        ...Object.keys(commentCounts)
      ]);

      allSubreddits.forEach(subreddit => {
        if (postCounts[subreddit] || commentCounts[subreddit]) {
          acc.push({
            username: result.data!.username,
            subreddit,
            posts: postCounts[subreddit] || 0,
            comments: commentCounts[subreddit] || 0
          });
        }
      });

      return acc;
    }, []);

    // Sort by total activity and take top N
    const sortedData = chartData
      .sort((a, b) => ((b.posts + b.comments) - (a.posts + a.comments)))
      .slice(0, 15); // Show top 15 most active combinations

    // Calculate Y-axis max
    const maxValue = Math.max(...sortedData.map(item => Math.max(item.posts, item.comments)));
    const yAxisMax = Math.ceil(maxValue / 10) * 10;

    return (
      <div style={{ width, height, backgroundColor: 'white', padding: '10px', fontFamily: 'Inter, sans-serif' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedData}
            margin={{ top: 20, right: 30, left: 150, bottom: 60 }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, yAxisMax]} />
            <YAxis
              type="category"
              dataKey={(entry) => `u/${entry.username} - r/${entry.subreddit}`}
              width={140}
              tick={{ fontSize: 10 }}
            />
            <RechartsTooltip
              contentStyle={{ fontSize: '12px' }}
              formatter={(value: number, name: string, props: any) => [
                value,
                `${name} in r/${props.payload.subreddit}`
              ]}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
            <Bar dataKey="posts" fill="#29ABE2" name="Posts">
              <LabelList
                dataKey="posts"
                position="right"
                style={{ fontSize: '8px', fill: '#333' }}
                formatter={(value: number) => value > 0 ? value : ''}
              />
            </Bar>
            <Bar dataKey="comments" fill="#77DDE7" name="Comments">
              <LabelList
                dataKey="comments"
                position="right"
                style={{ fontSize: '8px', fill: '#333' }}
                formatter={(value: number) => value > 0 ? value : ''}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const handleGeneratePdfReport = async () => {
    if (!canGenerateReport) {
      toast({ title: "No Data", description: "No analyzed profiles with data available to generate a report.", variant: "destructive" });
      return;
    }
    toast({ title: "Generating PDF Report...", description: "This may take a few moments. Please wait." });

    // Add chart dimensions
    const chartWidth = 750;  // Adjusted for landscape
    const chartHeight = 400; // Adjusted for better visibility

    // Prepare chart data
    const dailyChartData = prepareDailyChartData(currentDisplayResults);
    const subredditChartData = prepareSubredditChartData(currentDisplayResults);
    const userActivityData = prepareUserActivityChartData(currentDisplayResults);

    // Create PDF in landscape mode with A4 dimensions
    const doc = new jsPDF({ 
      orientation: 'landscape', 
      unit: 'pt', 
      format: 'a4',
      compress: true 
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 40;
    let yPos = margin;
    let pageNum = 1;

    // Updated colors for better visual appeal
    const primaryColor = [41, 171, 226];    // #29ABE2 - vibrant blue
    const secondaryColor = [119, 221, 231]; // #77DDE7 - light blue
    const textColor = [51, 51, 51];         // #333333 - dark gray
    const mutedTextColor = [128, 128, 128]; // #808080 - medium gray
    const lightGrayFill = [249, 250, 251];  // #F9FAFB - very light gray

    // Add decorative header bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 80, 'F');

    // White text for header on blue background
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.text("Insight Stream", margin, 50);

    // Subtitle
    doc.setFontSize(16);
    doc.text("Internal /External Reddit User Analysis Report", margin, 70);

    yPos = 250; // Add space after header

    // Add overview text with centered styling
    const centerX = pageWidth / 2;

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("Analysis Overview", centerX, yPos, { align: "center" });
    yPos += 40;

    // Add metadata with charts heading - centered
    doc.setFontSize(18);
    doc.text("Report Duration & Activity Charts", centerX, yPos, { align: "center" });
    yPos += 30;

    // Add metadata points - centered
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const metadata = [
      `Report Generated: ${format(new Date(), 'PPP p')}`,
      `Date Range: ${startDate ? format(startDate, 'MMM dd, yyyy') : 'Any'} to ${endDate ? format(endDate, 'MMM dd, yyyy') : 'Any'}`,
      `Total Profiles Analyzed: ${currentDisplayResults.length}`,
      `Blocked/Suspended Accounts: ${analysisResults.length - currentDisplayResults.length}`
    ];

    metadata.forEach(text => {
      doc.text(text, centerX, yPos, { align: "center" });
      yPos += 30;
    });

    const addNewPage = () => {
      doc.addPage();
      pageNum++;
      yPos = 60;
      
      // Add header to new page
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(`Insight Stream Report - Page ${pageNum}`, margin, 30);
    };

    const checkPageBreak = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - margin) {
        addNewPage();
        return true;
      }
      return false;
    };

    // First Chart Section - Daily Activity
    checkPageBreak(chartHeight + 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Daily Activity Overview", margin, yPos);
    yPos += 30;

    if (dailyChartData.length > 0) {
      const dailyChartImage = await renderChartToImage(DailyActivityChart, dailyChartData, 
        { width: chartWidth, height: chartHeight });
      if (dailyChartImage) {
        doc.addImage(dailyChartImage, 'PNG', margin, yPos, chartWidth, chartHeight);
        yPos += chartHeight + 60;
      }
    }

    // Second Chart Section - Subreddit Activity
    // Only check for page break, don't force new page
    if (subredditChartData.length > 0) {
      checkPageBreak(chartHeight + 60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Subreddits by Collective Activity", margin, yPos);
      yPos += 30;

      const subredditChartImage = await renderChartToImage(SubredditActivityChart, subredditChartData, 
        { width: chartWidth, height: chartHeight });
      if (subredditChartImage) {
        doc.addImage(subredditChartImage, 'PNG', margin, yPos, chartWidth, chartHeight);
        yPos += chartHeight + 60;
      }
    }

    // User Activity Chart
    if (userActivityData.length > 0) {
      checkPageBreak(chartHeight + 60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("User Activity Comparison", margin, yPos);
      yPos += 30;

      const userActivityChartImage = await renderChartToImage(UserActivityChart, userActivityData, 
        { width: chartWidth, height: chartHeight });
      if (userActivityChartImage) {
        doc.addImage(userActivityChartImage, 'PNG', margin, yPos, chartWidth, chartHeight);
        yPos += chartHeight + 60;
      }
    }

    // User Activity by Subreddit Chart
    if (currentDisplayResults.length > 0) {
      checkPageBreak(chartHeight + 60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("User Activity by Subreddit", margin, yPos);
      yPos += 30;

      const userSubredditChartImage = await renderChartToImage(
        UserSubredditActivityChart,
        currentDisplayResults,
        { width: chartWidth, height: chartHeight + 100 }
      );
      if (userSubredditChartImage) {
        doc.addImage(userSubredditChartImage, 'PNG', margin, yPos, chartWidth, chartHeight + 100);
        yPos += chartHeight + 160;
      }
    }

    // Add User Details Table
    checkPageBreak(100);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("User Profile Details", margin, yPos);
    yPos += 20;

    const userDetailsData = currentDisplayResults.map(result => ({
      Username: `u/${result.data?.username}`,
      'Account Created': result.data?.accountCreated ? format(parseISO(result.data.accountCreated), 'PPP') : 'N/A',
      'Post Karma': result.data?.totalPostKarma?.toLocaleString() || '0',
      'Comment Karma': result.data?.totalCommentKarma?.toLocaleString() || '0',
      'Posts Fetched': result.data?.totalPostsFetchedThisRun || '0',
      'Comments Fetched': result.data?.totalCommentsFetchedThisRun || '0'
    }));

    autoTable(doc, {
      head: [Object.keys(userDetailsData[0])],
      body: userDetailsData.map(obj => Object.values(obj)),
      startY: yPos,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: primaryColor },
      styles: { fontSize: 10 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 20;

    // Add Blocked Accounts Section if any
    const blockedAccounts = analysisResults.filter(r => 
      r.data?.suspensionStatus || r.data?.error || r.error
    );

    if (blockedAccounts.length > 0) {
      checkPageBreak(100);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Blocked/Suspended Accounts", margin, yPos);
      yPos += 20;

      autoTable(doc, {
        head: [['Username', 'Status', 'Last Checked']],
        body: blockedAccounts.map(account => [
          `u/${account.username}`,
          account.data?.suspensionStatus || 'Inaccessible',
          account.data?.lastErrorAt ? format(parseISO(account.data.lastErrorAt), 'PPP') : 'N/A'
        ]),
        startY: yPos,
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [239, 68, 68] }, // red color for blocked accounts
        styles: { fontSize: 10 }
      });
    }

    // Save the PDF
    doc.save(`insight_stream_reddit_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
    toast({ title: "PDF Report Generated", description: "Download should start shortly." });
  };


  const handleGenerateExcelReport = () => {
    console.log("Generate Excel Report clicked. Data:", currentDisplayResults, "Start Date:", startDate, "End Date:", endDate);
    toast({ title: "Excel Report (Placeholder)", description: "Excel report generation coming soon!" });
  };

  const canGenerateReport = useMemo(() => {
    return currentDisplayResults.filter(r => r.data && !r.data._placeholder && !r.data.error).length > 0;
  }, [currentDisplayResults]);


  if (authLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    router.replace('/login');
    return null;
  }
  
  const renderDataItem = (label: string, value: string | number | undefined | null, icon?: React.ReactNode) => (
    <div className="flex items-center justify-between py-2 px-1 even:bg-muted/30 rounded-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}:</span>
      </div>
      <span className="text-sm font-medium text-card-foreground break-all">{value ?? 'N/A'}</span>
    </div>
  );

  const combinedTableColumns: ColumnConfig<ExternalRedditUserDataItem>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (item) => (
        <Badge variant={item.type === 'Post' ? 'secondary' : 'outline'} className="whitespace-nowrap">
          {item.type}
        </Badge>
      ),
      className: "w-[100px]"
    },
    {
      key: 'titleOrContent',
      header: 'Title / Content',
      render: (item) => (
        <div className="line-clamp-2 hover:line-clamp-none transition-all max-w-sm sm:max-w-md md:max-w-lg xl:max-w-xl">
           {item.titleOrContent}
        </div>
      ),
      className: "w-[calc(55%-100px)]" 
    },
    {
      key: 'subreddit',
      header: 'Subreddit',
      render: (item) => <Badge variant="secondary" className="whitespace-nowrap">{item.subreddit}</Badge>,
      className: "whitespace-nowrap"
    },
    {
      key: 'timestamp',
      header: 'Date',
      render: (item) => format(parseISO(item.timestamp), 'MMM dd, yyyy'),
      className: "whitespace-nowrap"
    },
    {
      key: 'score',
      header: 'Upvotes',
      render: (item) => <span className="text-right block">{item.score.toLocaleString()}</span>,
      className: "text-right whitespace-nowrap"
    },
    {
      key: 'numComments',
      header: 'Replies',
      render: (item) => (
        <span className="text-right block">
          {item.type === 'Post' ? (item.numComments?.toLocaleString() ?? '0') : 'N/A'}
        </span>
      ),
      className: "text-right whitespace-nowrap"
    },
    {
      key: 'url',
      header: 'Link',
      render: (item) => (
        <Button variant="ghost" size="icon" asChild className="h-7 w-7">
          <a href={item.url} target="_blank" rel="noopener noreferrer" title={`Open on Reddit`}>
            <ChevronsUpDown className="h-4 w-4 text-primary" />
          </a>
        </Button>
      ),
      className: "text-center whitespace-nowrap"
    },
  ];

  const renderDataTable = (items: ExternalRedditUserDataItem[], columns: ColumnConfig<ExternalRedditUserDataItem>[]) => {
    if (!items || items.length === 0) {
      let message = `No posts or comments found for this user.`;
      if (startDate || endDate) {
        message = `No posts or comments match the selected date range for this user.`;
      }
      return <p className="text-sm text-muted-foreground py-3 px-1">{message}</p>;
    }
    return (
      <div className="overflow-x-auto rounded-md border mt-2">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={String(col.key)} className={cn("whitespace-nowrap", col.className)}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id}>
                {columns.map(col => (
                   <TableCell key={String(col.key)} className={cn(col.className, col.key === 'titleOrContent' ? 'font-medium' : '', 'text-sm')}>
                    {col.render ? col.render(item) : String(item[col.key as keyof ExternalRedditUserDataItem] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };


  return (
    <div className="w-full space-y-6 overflow-x-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          title="Total Usernames"
          value={formatStatNumber(analysisResults.length)} // Total users added
          icon={Users}
          iconBgClass="bg-indigo-500"
        />
        <StatCard
          title="Blocked Accounts"
          value={formatStatNumber(analysisResults.length - currentDisplayResults.length)} // Blocked accounts
          icon={UserXIcon}
          iconBgClass="bg-red-500"
        />
        <StatCard
          title="Total Posts Fetched"
          value={formatStatNumber(summaryStats.totalPosts)}
          icon={FileText}
          iconBgClass="bg-sky-500"
        />
        <StatCard
          title="Total Comments Fetched"
          value={formatStatNumber(summaryStats.totalComments)}
          icon={MessagesSquare}
          iconBgClass="bg-emerald-500"
        />
        <StatCard
          title="Total Combined Upvotes"
          value={formatStatNumber(summaryStats.totalScore)}
          icon={TrendingUp}
          iconBgClass="bg-amber-500"
        />
        <StatCard
          title="Total Post Replies"
          value={formatStatNumber(summaryStats.totalReplies)}
          icon={MessageCircleReply}
          iconBgClass="bg-rose-500"
        />
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl font-headline flex items-center">
            <UserSearch className="mr-3 h-7 w-7 text-primary" />
            External Reddit User Analyzer
          </CardTitle>
          <CardDescription>
            Analyze Reddit user profiles. Enter a username or upload a CSV to register users for analysis.
            Data is fetched and stored in Firestore.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-grow space-y-1.5">
                <label htmlFor="single-username-input" className="text-sm font-medium text-muted-foreground">
                    Enter a single Reddit username (without u/)
                </label>
                <Input
                    id="single-username-input"
                    type="text"
                    placeholder="e.g., spez"
                    value={singleUsername}
                    onChange={(e) => setSingleUsername(e.target.value)}
                    disabled={isProcessingCsv || isUpdatingAll || analysisResults.some(r => r.isLoading || r.isRefreshing)}
                    className="bg-background shadow-sm"
                />
            </div>
            <Button 
              onClick={handleAnalyzeSingleUser} 
              disabled={isProcessingCsv || isUpdatingAll || !singleUsername.trim() || analysisResults.some(r => r.isLoading || r.isRefreshing)}
              className="w-full sm:w-auto"
            >
              <UserSearch className="mr-2 h-4 w-4" /> Add & Analyze User
            </Button>
          </div>

          <div className="relative flex items-center justify-center my-4">
            <Separator className="flex-grow" />
            <span className="mx-4 text-sm text-muted-foreground bg-card px-2">OR</span>
            <Separator className="flex-grow" />
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
                <label htmlFor="csv-upload" className="text-sm font-medium text-muted-foreground">
                    Upload CSV to register usernames (Header: "USER_NAME" or "username")
                </label>
                <div className="flex items-center gap-3">
                    <Input
                        id="csv-upload"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleFileUpload}
                        disabled={isProcessingCsv || isUpdatingAll || analysisResults.some(r => r.isLoading || r.isRefreshing)}
                        className="flex-grow file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer shadow-sm"
                    />
                    {fileName && !isProcessingCsv && (
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                            <FileText className="mr-1.5 h-3 w-3"/>{fileName}
                        </Badge>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap gap-3">
                <Button onClick={handleDownloadTemplate} variant="outline" size="sm" disabled={isProcessingCsv || isUpdatingAll || analysisResults.some(r => r.isLoading || r.isRefreshing)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV Template
                </Button>
                 <Button onClick={handleUpdateAll} disabled={isLoadingStoredData || isUpdatingAll || isProcessingCsv || analysisResults.length === 0 || analysisResults.some(r => r.isLoading || r.isRefreshing)}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isUpdatingAll ? 'animate-spin' : ''}`} />
                    {isUpdatingAll ? 'Updating All...' : 'Update All Profiles'}
                </Button>
                <Button onClick={handleOpenUserListDialog} variant="outline" size="sm" disabled={isProcessingCsv || isUpdatingAll || isLoadingUserListDialog || analysisResults.some(r => r.isLoading || r.isRefreshing)}>
                    <ListTree className="mr-2 h-4 w-4" />
                    User list
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={!canGenerateReport || isLoadingStoredData || isUpdatingAll || isProcessingCsv || analysisResults.some(r => r.isLoading || r.isRefreshing)}>
                      <Download className="mr-2 h-4 w-4" />
                      Get Report
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleGeneratePdfReport} disabled={!canGenerateReport}>
                      <FileText className="mr-2 h-4 w-4" />
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleGenerateExcelReport} disabled={!canGenerateReport}>
                      <Sheet className="mr-2 h-4 w-4" />
                      Export as Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {(isProcessingCsv || isUpdatingAll) && (
                <div className="mt-2 flex items-center text-sm text-primary">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isProcessingCsv ? "Processing CSV..." : "Updating all profiles..."} This may take some time.
                </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isUserListDialogOpen} onOpenChange={setIsUserListDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registered Reddit Usernames</DialogTitle>
            <DialogDescription>
              Usernames registered for analysis. Delete to remove their stored data.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[300px] w-full rounded-md border p-4 my-4">
            {isLoadingUserListDialog ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : savedUsernamesForDialog.length > 0 ? (
              <ul className="space-y-1">
                {savedUsernamesForDialog.map((name, index) => (
                  <li key={index} className="text-sm p-1.5 bg-muted/50 rounded-sm flex justify-between items-center group">
                    <span>u/{name}</span>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-50 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteUserAnalysis(name)}
                        disabled={isDeletingUser && userToDelete === name}
                        title={`Delete analysis for u/${name}`}
                    >
                        {isDeletingUser && userToDelete === name ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No Reddit usernames are currently registered for analysis.
              </p>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setIsUserListDialogOpen(false)} variant="outline">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove all analysis data for Reddit user u/{userToDelete}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)} disabled={isDeletingUser}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeletingUser} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {isDeletingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-headline flex items-center">
            <SearchCheck className="mr-2 h-5 w-5 text-primary" />
            Filter Posts/Comments by Date
          </CardTitle>
          <CardDescription>
            Select a date range to filter the posts and comments shown within each profile card below. Profile cards themselves will remain visible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-grow">
              <div className="space-y-1.5">
                <Label htmlFor="start-date">From Date</Label>
                <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
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
                      {startDate ? format(startDate, "PPP") : <span>Pick a start date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        setStartDate(date);
                        setTimeout(() => setIsStartDatePickerOpen(false), 0);
                      }}
                      disabled={(date) => (endDate ? date > endDate : false) || date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-date">To Date</Label>
                <Popover open={isEndDatePickerOpen} onOpenChange={setIsEndDatePickerOpen}>
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
                      {endDate ? format(endDate, "PPP") : <span>Pick an end date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        setEndDate(date);
                        setTimeout(() => setIsEndDatePickerOpen(false), 0);
                      }}
                      disabled={(date) => (startDate ? date < startDate : false) || date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button onClick={handleResetFilters} variant="outline" className="w-full sm:w-auto mt-2 sm:mt-0">
              <FilterX className="mr-2 h-4 w-4" />
              Reset Date Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoadingStoredData && analysisResults.length === 0 && !isProcessingCsv && (
         <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <DatabaseZap className="h-10 w-10 text-primary mb-3 animate-pulse" />
            <p>Loading stored profiles from database...</p>
        </div>
      )}

      {!isLoadingStoredData && analysisResults.length === 0 && !isProcessingCsv && (
         <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground bg-card rounded-lg shadow-lg p-8 border">
            <UserXIcon className="h-16 w-16 text-primary mb-4" /> 
            <p className="text-xl font-semibold mb-2">No Profiles Registered</p>
            <p className="text-sm">
              Add a Reddit username above or upload a CSV file to begin registering profiles for analysis.
            </p>
            <p className="text-xs mt-3">Your registered profiles will appear here after analysis.</p>
        </div>
      )}

      {analysisResults.length > 0 && (
        <div className="w-full space-y-8 mt-8 overflow-x-auto">
          {analysisResults.map((result, index) => {
            const isInitialLoading = result.isLoading && !result.isRefreshing && (!result.data || result.data._placeholder);
            const isActualRefreshing = result.isRefreshing;
            const isPending = result.data?._placeholder === true && !result.isLoading && !result.isRefreshing && !result.error && !result.data.error;
            const hasFlowError = !!result.data?.error; 
            const hasClientError = !!result.error; 
            const displayError = result.data?.error || result.error;

            let cardBorderClass = "border-border/70"; 
            let StatusIcon = InfoIcon;
            let statusIconColor = "text-primary";

            if (isInitialLoading || isActualRefreshing) {
              cardBorderClass = "border-t-4 border-t-blue-500 animate-pulse";
              StatusIcon = Hourglass;
              statusIconColor = "text-blue-500";
            } else if (hasFlowError || hasClientError) {
              cardBorderClass = "border-t-4 border-t-red-500";
              StatusIcon = AlertTriangle;
              statusIconColor = "text-red-500";
            } else if (isPending) {
              cardBorderClass = "border-t-4 border-t-amber-500";
              StatusIcon = InfoIcon;
              statusIconColor = "text-amber-500";
            } else if (result.data && !result.data._placeholder && result.data.lastRefreshedAt) {
              cardBorderClass = "border-t-4 border-t-green-500";
              StatusIcon = Clock; 
              statusIconColor = "text-green-500";
            }
            
            const combinedItemsUnfiltered = (result.data && !result.data._placeholder) ? [
              ...(result.data.fetchedPostsDetails || []),
              ...(result.data.fetchedCommentsDetails || []),
            ].sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()) : [];
        
            const filteredCombinedItems = combinedItemsUnfiltered.filter(item => {
                if (!startDate && !endDate) return true;
                const itemDate = parseISO(item.timestamp);
                let inRange = true;
                if (startDate) inRange = inRange && (itemDate >= startOfDay(startDate));
                if (endDate) inRange = inRange && (itemDate <= endOfDay(endDate));
                return inRange;
            });


            return (
            <Card key={`${result.username}-${index}`} className={cn("shadow-md transition-all duration-300 hover:shadow-xl", cardBorderClass)}>
              <CardHeader className="bg-muted/20 rounded-t-lg p-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center">
                      <StatusIcon className={cn("mr-2 h-5 w-5 flex-shrink-0", statusIconColor, (isInitialLoading || isActualRefreshing) && "animate-spin")} />
                      <span>Profile: <span className="text-primary font-bold">u/{result.username}</span></span>
                    </CardTitle>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRefreshAnalysis(result.username)}
                        disabled={result.isLoading || result.isRefreshing || isProcessingCsv || isUpdatingAll}
                        className="whitespace-nowrap"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${(result.isLoading || result.isRefreshing) ? 'animate-spin' : ''}`} />
                        {(isPending || (!result.data?.lastRefreshedAt && !displayError)) ? 'Analyze' : 'Refresh'}
                    </Button>
                </div>
                 {result.data?.lastRefreshedAt && !displayError && !isPending && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center">
                        <Clock className="mr-1.5 h-3 w-3" />
                        Last updated: {formatDistanceToNow(parseISO(result.data.lastRefreshedAt), { addSuffix: true })}
                    </div>
                )}
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                {isInitialLoading ? (
                    <RedditAnalysisCardSkeleton />
                ) : (displayError) ? (
                  <div className="text-red-600 bg-red-50/70 p-4 rounded-md border border-red-200 flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-red-700 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-red-700">This account has been suspended</p>
                        <p className="text-sm">{displayError}</p>
                    </div>
                  </div>
                ) : isPending ? (
                     <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <InfoIcon className="h-8 w-8 mb-2 text-amber-500"/>
                        <p className="font-medium">Analysis pending for u/{result.username}.</p>
                        <p className="text-xs">Click "Analyze" on this card or "Update All Profiles".</p>
                    </div>
                ) : result.data && result.data.lastRefreshedAt && (
                  <div className="space-y-4">
                    <Card className="bg-background/50">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-base font-medium">Profile Overview</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                        {renderDataItem('Account Created', result.data.accountCreated ? format(parseISO(result.data.accountCreated), 'PPP') : 'N/A', <Clock className="h-4 w-4" />)}
                        {renderDataItem('Total Post Karma', formatStatNumber(result.data.totalPostKarma), <FileText className="h-4 w-4" />)}
                        {renderDataItem('Total Comment Karma', formatStatNumber(result.data.totalCommentKarma), <MessageSquare className="h-4 w-4" />)}
                        {renderDataItem('Posts Analyzed', formatStatNumber(result.data.totalPostsFetchedThisRun), <Database className="h-4 w-4" />)}
                        {renderDataItem('Comments Analyzed', formatStatNumber(result.data.totalCommentsFetchedThisRun), <ListChecks className="h-4 w-4" />)}
                        {renderDataItem('Subreddits Posted In', formatStatNumber(result.data.subredditsPostedIn.length), <BarChart3 className="h-4 w-4" />)}
                      </CardContent>
                    </Card>

                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="items">
                        <AccordionTrigger className="text-base font-medium hover:no-underline">
                          <div className="flex items-center gap-3">
                            <ListTree className="h-5 w-5 text-primary" />
                            <span>Posts & Comments</span>
                            <Badge variant="secondary" className="ml-2">
                              {filteredCombinedItems.length} items
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {renderDataTable(filteredCombinedItems, combinedTableColumns)}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )}
              </CardContent>
              {(result.data && (result.data.lastRefreshedAt || result.data._placeholder || displayError)) && (
                <CardFooter className="p-4 bg-muted/20 rounded-b-lg text-xs text-muted-foreground justify-end">
                    <Link href={`https://www.reddit.com/user/${result.username}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                        View u/{result.username} on Reddit &rarr;
                    </Link>
                </CardFooter>
              )}
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
