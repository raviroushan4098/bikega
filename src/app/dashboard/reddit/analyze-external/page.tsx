
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
import { doc, updateDoc } from 'firebase/firestore';
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

const SubredditActivityChart = ({ data, width = 600, height = 350 }: { data: { subreddit: string; posts: number; comments: number }[], width?: number, height?: number }) => (
  <div style={{ width, height, backgroundColor: 'white', padding: '10px', fontFamily: 'Inter, sans-serif' }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 70 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="subreddit" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
        <RechartsTooltip contentStyle={{ fontSize: '12px' }} />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
        <Bar dataKey="posts" fill="#29ABE2" name="Posts">
           <LabelList dataKey="posts" position="top" style={{ fontSize: '8px', fill: '#333' }} formatter={(value: number) => value > 0 ? value : ''} />
        </Bar>
        <Bar dataKey="comments" fill="#77DDE7" name="Comments">
           <LabelList dataKey="comments" position="top" style={{ fontSize: '8px', fill: '#333' }} formatter={(value: number) => value > 0 ? value : ''} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

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
            console.error(`Error analyzing/refreshing user ${usernameToAnalyze} (from flow):`, resultFromFlow.error);
            if (!isUpdatingAll) { 
                toast({ variant: "destructive", title: `Analysis Failed for u/${usernameToAnalyze}`, description: resultFromFlow.error, duration: 7000 });
            }
            setAnalysisResults(prev => prev.map(r =>
                r.username === usernameToAnalyze ? { username: usernameToAnalyze, error: resultFromFlow.error, isLoading: false, isRefreshing: false, data: r.data ? {...r.data, error: resultFromFlow.error} : undefined } : r
            ));

            // Update Firestore document with suspension status if analysis fails
 try {
 await setDoc(doc(db, `users/${appUserIdForCall}/redditAnalyses`, usernameToAnalyze), {
 suspensionStatus: "This account has been suspended"
 }, { merge: true });
 } catch (dbError) {
 console.error(`Failed to update Firestore for user ${usernameToAnalyze} with suspension status:`, dbError);
 }
        }
 else {
            setAnalysisResults(prev => prev.map(r =>
                r.username === usernameToAnalyze ? { username: usernameToAnalyze, data: {...resultFromFlow, _placeholder: false}, isLoading: false, isRefreshing: false, error: undefined } : r
            ));
            if (!isUpdatingAll && isRefreshOp) {
                toast({ title: `Refreshed u/${usernameToAnalyze}`, description: "Data updated successfully." });
            }
        }
    } catch (error) { 
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during analysis.";
        console.error(`[Client] Error calling analyzeExternalRedditUser for ${usernameToAnalyze}:`, error);
        if (!isUpdatingAll) { 
            toast({ variant: "destructive", title: `Analysis Failed for u/${usernameToAnalyze}`, description: errorMessage, duration: 7000 });
        }
        setAnalysisResults(prev => prev.map(r =>
            r.username === usernameToAnalyze ? { username: usernameToAnalyze, error: errorMessage, isLoading: false, isRefreshing: false, data: r.data ? {...r.data, error: errorMessage } : undefined } : r 
        ));

        // Update Firestore document with suspension status if analysis fails
 try {
 await setDoc(doc(db, `users/${appUserIdForCall}/redditAnalyses`, usernameToAnalyze), {
 suspensionStatus: "An error occurred during analysis" // Or refine based on actual error type
 }, { merge: true });
 } catch (dbError) {
 console.error(`Failed to update Firestore for user ${usernameToAnalyze} with suspension status:`, dbError);
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
      
      setAnalysisResults(prev => [{ 
          username: trimmedUsername, 
          isLoading: true, 
          isRefreshing: false, 
          error: undefined, 
          data: { 
              username: trimmedUsername, _placeholder: true, lastRefreshedAt: null,
              accountCreated: null, totalPostKarma: 0, totalCommentKarma: 0, subredditsPostedIn: [],
              totalPostsFetchedThisRun: 0, totalCommentsFetchedThisRun: 0,
              fetchedPostsDetails: [], fetchedCommentsDetails: [],
          }
      }, ...prev.sort((a, b) => a.username.localeCompare(b.username))]);
      await processSingleUsername(trimmedUsername, false, currentUser.id);
    } else {
      await processSingleUsername(trimmedUsername, true, currentUser.id);
    }
    setSingleUsername(''); 
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser?.id) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast({ variant: "destructive", title: "Invalid File", description: "Please upload a .csv file." });
 event.target.value = '';
 setFileName(null);
 setIsProcessingCsv(false);
 return;
    }
    setFileName(file.name);
    setIsProcessingCsv(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
          toast({ variant: "destructive", title: "File Error", description: "CSV file is empty or could not be read." });
          setIsProcessingCsv(false);
 
 
 
 setFileName(null);
          event.target.value = '';
          return;
      }
      
      let lines = text.split(/\\r\\n|\\n|\\r/); 
      const header = lines[0].toLowerCase();
      if (header.includes('user_name') || header.includes('username')) { 
        lines.shift(); 
      }

      const csvUsernamesRaw = lines
        .flatMap(line => line.split(',')) 
        .map(usernamePart => usernamePart.trim().replace(/^u\//i, '')) 
        .filter(username => username !== ''); 
      
      const uniqueCsvUsernames = Array.from(new Set(csvUsernamesRaw));

      if (uniqueCsvUsernames.length === 0) {
        toast({ variant: "destructive", title: "No Usernames", description: "No valid usernames found in the CSV file." });
        event.target.value = ''; 
        setFileName(null);
        setIsProcessingCsv(false);
        return;
      }
      
      let newPlaceholdersCreated = 0;
      let alreadyExistedOrRegisteredCount = 0;

      for (const username of uniqueCsvUsernames) {
        const result = await addOrUpdateRedditUserPlaceholder(currentUser.id, username);
        if ('error' in result) {
          console.error(`Failed to add/update placeholder for ${username}: ${result.error}`);
        } else if (result.new) {
          newPlaceholdersCreated++;
        } else {
          alreadyExistedOrRegisteredCount++;
        }
      }
      
      toast({ 
        title: "CSV Processed", 
        description: `${newPlaceholdersCreated} new usernames registered as placeholders. ${alreadyExistedOrRegisteredCount} already existed. Click "Update All Profiles" or individual "Analyze" buttons to fetch data.`,
        duration: 8000 
      });
      
      await fetchAndSetStoredAnalyses(); 

      setIsProcessingCsv(false);
      event.target.value = ''; 
      setFileName(null);
    };
    reader.onerror = () => {
      toast({ variant: "destructive", title: "File Read Error", description: "Could not read the file."});
      setFileName(null);
      event.target.value = ''; 
      setIsProcessingCsv(false);
    }
    reader.readAsText(file);
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
    setIsConfirmDeleteDialogOpen(true);
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
    let totalUsernames = currentDisplayResults.length;
    let totalPosts = 0;
    let totalComments = 0;
    let totalScore = 0;
    let totalReplies = 0;

    currentDisplayResults.forEach(result => {
      if (result.data && !result.data._placeholder) {
        result.data.fetchedPostsDetails.forEach(post => {
          totalPosts++;
          totalScore += post.score;
          totalReplies += post.numComments || 0;
        });
        result.data.fetchedCommentsDetails.forEach(comment => {
          totalComments++;
          totalScore += comment.score;
        });
      }
    });
    return { totalUsernames, totalPosts, totalComments, totalScore, totalReplies };
  }, [currentDisplayResults]);


  const handleGeneratePdfReport = async () => {
    if (!canGenerateReport) {
        toast({ title: "No Data", description: "No analyzed profiles with data available to generate a report.", variant: "destructive" });
        return;
    }
    toast({ title: "Generating PDF Report...", description: "This may take a few moments. Please wait." });

    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    doc.setProperties({
        title: 'Insight Stream - Aggregated Reddit User Analysis Report',
        author: 'Insight Stream',
    });
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 40;
    let yPos = margin;
    let pageNum = 1;
    const totalPagesPlaceholder = "{totalPages}"; 

    const primaryColor = [41, 171, 226]; 
    const accentColor = [119, 221, 231]; 
    const textColor = [40, 40, 40];
    const mutedTextColor = [100, 100, 100];
    const lightGrayFill = [240, 240, 240];

    const addPageHeaderFooter = (pdfDoc: jsPDF, currentPage: number, totalPages: string | number) => {
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
        pdfDoc.text("Aggregated Reddit User Analysis", margin, margin / 2);
        pdfDoc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin - 50, pageHeight - margin / 2);
        pdfDoc.text(`Generated: ${format(new Date(), 'PPP p')}`, margin, pageHeight - margin/2);
    };
    
    const addPageIfNeeded = (currentY: number, spaceNeeded: number): number => {
        if (currentY + spaceNeeded > pageHeight - margin - 20) { 
            doc.addPage();
            pageNum++;
            addPageHeaderFooter(doc, pageNum, totalPagesPlaceholder);
            return margin + 20; 
        }
        return currentY;
    };

    const drawSectionSeparator = (currentY: number): number => {
        currentY += 5; // Small space before line
        doc.setDrawColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 15; // Space after line
        return currentY;
    };


    // --- Report Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Insight Stream", margin, yPos);
    yPos += 35;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(18);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text("Aggregated Reddit User Analysis Report", margin, yPos);
    yPos += 20;
    doc.setFontSize(10);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    const dateRangeStr = `Date Filters: ${startDate ? format(startDate, 'MMM dd, yyyy') : 'Any'} to ${endDate ? format(endDate, 'MMM dd, yyyy') : 'Any'}`;
    doc.text(dateRangeStr, margin, yPos);
    yPos += 15;
    doc.text(`Report Generated: ${format(new Date(), 'PPP p')}`, margin, yPos);
    yPos += 15;
    const analyzedProfilesCount = currentDisplayResults.length;
    doc.text(`Profiles Analyzed: ${analyzedProfilesCount}`, margin, yPos);
    yPos += 25;

    addPageHeaderFooter(doc, pageNum, totalPagesPlaceholder);

    // --- Overall Performance Summary Section ---
    yPos = addPageIfNeeded(yPos, 30);
    yPos = drawSectionSeparator(yPos);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Overall Performance Summary", margin, yPos);
    yPos += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    const allFilteredItems: ExternalRedditUserDataItem[] = currentDisplayResults.flatMap(result => {
      const userItems = [...(result.data?.fetchedPostsDetails || []), ...(result.data?.fetchedCommentsDetails || [])];
      return userItems.filter(item => {
        if (!startDate && !endDate) return true;
        const itemDate = parseISO(item.timestamp);
        let inRange = true;
        if (startDate) inRange = inRange && (itemDate >= startOfDay(startDate));
        if (endDate) inRange = inRange && (itemDate <= endOfDay(endDate));
        return inRange;
      });
    });

    const totalFilteredPosts = allFilteredItems.filter(item => item.type === 'Post').length;
    const totalFilteredComments = allFilteredItems.filter(item => item.type === 'Comment').length;
    const totalFilteredScore = allFilteredItems.reduce((sum, item) => sum + item.score, 0);
    const totalFilteredReplies = allFilteredItems.filter(item => item.type === 'Post').reduce((sum, post) => sum + (post.numComments || 0), 0);
    
    const avgPostsPerUser = analyzedProfilesCount > 0 ? (totalFilteredPosts / analyzedProfilesCount).toFixed(1) : '0.0';
    const avgCommentsPerUser = analyzedProfilesCount > 0 ? (totalFilteredComments / analyzedProfilesCount).toFixed(1) : '0.0';

    const summaryPoints = [
        `Total Posts (Filtered): ${totalFilteredPosts.toLocaleString()}`,
        `Total Comments (Filtered): ${totalFilteredComments.toLocaleString()}`,
        `Total Combined Score (Filtered): ${totalFilteredScore.toLocaleString()}`,
        `Total Post Replies (Filtered): ${totalFilteredReplies.toLocaleString()}`,
        `Average Posts per User: ${avgPostsPerUser}`,
        `Average Comments per User: ${avgCommentsPerUser}`,
    ];
    summaryPoints.forEach(line => { yPos = addPageIfNeeded(yPos, 15); doc.text(line, margin, yPos); yPos += 15; });
    yPos += 10;

    // --- Visualizations Section ---
    yPos = addPageIfNeeded(yPos, 30);
    yPos = drawSectionSeparator(yPos);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Aggregated Visualizations", margin, yPos);
    yPos += 20;

    // Overall Daily Activity Chart
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text("Overall Daily Activity Trend (All Users, Filtered)", margin, yPos); yPos += 15;
    const dailyDataMap = new Map<string, { date: string; posts: number; comments: number }>();
    allFilteredItems.forEach(item => {
        const itemDateStr = format(parseISO(item.timestamp), 'yyyy-MM-dd');
        if (!dailyDataMap.has(itemDateStr)) { dailyDataMap.set(itemDateStr, { date: itemDateStr, posts: 0, comments: 0 }); }
        const dayEntry = dailyDataMap.get(itemDateStr)!;
        if (item.type === 'Post') dayEntry.posts++; else if (item.type === 'Comment') dayEntry.comments++;
    });
    const dailyChartDataAggregated = Array.from(dailyDataMap.values()).sort((a,b) => a.date.localeCompare(b.date));
    if (dailyChartDataAggregated.length > 0) {
      const dailyChartImage = await renderChartToImage(DailyActivityChart, dailyChartDataAggregated, { width: 500, height: 250 });
      if (dailyChartImage) {
          yPos = addPageIfNeeded(yPos, 250 * 0.75);
          doc.addImage(dailyChartImage, 'PNG', margin, yPos, 500 * 0.75, 250 * 0.75); 
          yPos += (250 * 0.75) + 20;
      } else {
          yPos = addPageIfNeeded(yPos, 15); doc.setFontSize(9); doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
          doc.text("Daily activity chart generation failed.", margin, yPos); yPos += 15;
      }
    } else {
       yPos = addPageIfNeeded(yPos, 15); doc.setFontSize(9); doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
       doc.text("No daily activity data for chart in filtered range.", margin, yPos); yPos += 15;
    }

    // Top Subreddits by Collective Activity
    yPos = addPageIfNeeded(yPos, 30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text("Top Subreddits by Collective Activity (Filtered, Top 10)", margin, yPos); yPos += 15;
    const collectiveSubredditCounts: Record<string, {posts: number, comments: number}> = {};
    allFilteredItems.forEach(item => {
        const sub = item.subreddit || 'N/A';
        if(!collectiveSubredditCounts[sub]) collectiveSubredditCounts[sub] = {posts: 0, comments: 0};
        if(item.type === 'Post') collectiveSubredditCounts[sub].posts++;
        else collectiveSubredditCounts[sub].comments++;
    });
    const collectiveSubredditChartData = Object.entries(collectiveSubredditCounts)
        .map(([name, counts]) => ({subreddit: name, ...counts}))
        .sort((a,b) => (b.posts + b.comments) - (a.posts + a.comments)).slice(0,10);
    if (collectiveSubredditChartData.length > 0) {
      const subChartImage = await renderChartToImage(SubredditActivityChart, collectiveSubredditChartData, {width: 500, height: 300});
      if (subChartImage) {
          yPos = addPageIfNeeded(yPos, 300 * 0.75);
          doc.addImage(subChartImage, 'PNG', margin, yPos, 500 * 0.75, 300 * 0.75);
          yPos += (300 * 0.75) + 20;
      } else {
          yPos = addPageIfNeeded(yPos, 15); doc.setFontSize(9); doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
          doc.text("Subreddit activity chart generation failed.", margin, yPos); yPos += 15;
      }
    } else {
       yPos = addPageIfNeeded(yPos, 15); doc.setFontSize(9); doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
       doc.text("No subreddit activity data for chart in filtered range.", margin, yPos); yPos += 15;
    }

    // Overall Sentiment Pie Chart
    yPos = addPageIfNeeded(yPos, 30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text("Overall Sentiment Distribution (Placeholder Data)", margin, yPos); yPos += 15;
    // Placeholder: Sentiment analysis for each item is not yet in ExternalRedditUserDataItem
    const aggregatedSentimentData: { name: string; value: number }[] = [
        { name: 'Positive', value: 0 }, { name: 'Negative', value: 0 },
        { name: 'Neutral', value: 0 }, { name: 'Unknown', value: 0 },
    ];
    if(allFilteredItems.length > 0){ // Dummy distribution
        aggregatedSentimentData.find(s=>s.name === 'Positive')!.value = Math.floor(Math.random()*allFilteredItems.length/2);
        aggregatedSentimentData.find(s=>s.name === 'Neutral')!.value = Math.floor(Math.random()*allFilteredItems.length/2);
        aggregatedSentimentData.find(s=>s.name === 'Negative')!.value = allFilteredItems.length - aggregatedSentimentData.find(s=>s.name === 'Positive')!.value - aggregatedSentimentData.find(s=>s.name === 'Neutral')!.value;
    }
    const pieChartImage = await renderChartToImage(SentimentPieChart, aggregatedSentimentData.filter(s => s.value > 0), { width: 450, height: 250 });
    if (pieChartImage) {
        yPos = addPageIfNeeded(yPos, 250 * 0.75);
        doc.addImage(pieChartImage, 'PNG', margin, yPos, 450 * 0.75, 250 * 0.75);
        yPos += (250 * 0.75) + 20;
    } else {
        yPos = addPageIfNeeded(yPos, 15); doc.setFontSize(9); doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
        doc.text("Sentiment pie chart generation failed.", margin, yPos); yPos+=15;
    }
    yPos += 10;

    // --- Engagement Highlights Section ---
    yPos = addPageIfNeeded(yPos, 30);
    yPos = drawSectionSeparator(yPos);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Overall Engagement Highlights (Filtered Data)", margin, yPos);
    yPos += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    const allFilteredPostsOnly = allFilteredItems.filter(item => item.type === 'Post');
    const topPostByScore = [...allFilteredPostsOnly].sort((a, b) => b.score - a.score)[0];
    const topPostByReplies = [...allFilteredPostsOnly].sort((a, b) => (b.numComments || 0) - (a.numComments || 0))[0];
    
    doc.setFont("helvetica", "bold"); doc.text("Highest Scored Post:", margin, yPos); yPos += 15; doc.setFont("helvetica", "normal");
    if (topPostByScore) {
        doc.text(`  Title: "${topPostByScore.titleOrContent.substring(0, 60)}..." (Score: ${topPostByScore.score})`, margin + 10, yPos); yPos += 12;
        doc.text(`  Author: u/${currentDisplayResults.find(r => r.data?.fetchedPostsDetails.some(p => p.id === topPostByScore.id))?.username || 'N/A'}, Subreddit: ${topPostByScore.subreddit}`, margin + 10, yPos); yPos += 15;
    } else { doc.text("  N/A", margin + 10, yPos); yPos += 15; }

    doc.setFont("helvetica", "bold"); doc.text("Most Replied-To Post:", margin, yPos); yPos += 15; doc.setFont("helvetica", "normal");
    if (topPostByReplies) {
        doc.text(`  Title: "${topPostByReplies.titleOrContent.substring(0, 60)}..." (Replies: ${topPostByReplies.numComments || 0})`, margin + 10, yPos); yPos += 12;
        doc.text(`  Author: u/${currentDisplayResults.find(r => r.data?.fetchedPostsDetails.some(p => p.id === topPostByReplies.id))?.username || 'N/A'}, Subreddit: ${topPostByReplies.subreddit}`, margin + 10, yPos); yPos += 15;
    } else { doc.text("  N/A", margin + 10, yPos); yPos += 15; }
    yPos += 10;

    // --- Detailed Activity Log Table ---
    yPos = addPageIfNeeded(yPos, 40);
    yPos = drawSectionSeparator(yPos);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Consolidated Activity Log (Filtered)", margin, yPos); yPos += 5; 

    if (allFilteredItems.length > 0) {
        const tableData = allFilteredItems.map(item => {
            const itemOwnerUsername = currentDisplayResults.find(result => 
                result.data?.fetchedPostsDetails.some(p => p.id === item.id) || 
                result.data?.fetchedCommentsDetails.some(c => c.id === item.id)
            )?.username || 'N/A';

            return [
                itemOwnerUsername,
                item.type,
                format(parseISO(item.timestamp), 'MM/dd/yy HH:mm'),
                item.subreddit,
                item.titleOrContent.length > 50 ? item.titleOrContent.substring(0,47) + '...' : item.titleOrContent,
                item.score,
                item.type === 'Post' ? item.numComments ?? 0 : '-',
            ];
        });

        autoTable(doc, {
            startY: yPos,
            head: [['User', 'Type', 'Date', 'Subreddit', 'Title/Content', 'Score', 'Replies']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak', font: 'helvetica' },
            headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 8, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: lightGrayFill },
            columnStyles: { 
                0: {cellWidth: 60}, // User
                1: {cellWidth: 35}, // Type
                2: {cellWidth: 55}, // Date
                3: {cellWidth: 65}, // Subreddit
                4: {cellWidth: 'auto'}, // Title/Content
                5: {cellWidth: 30, halign: 'right'}, // Score
                6: {cellWidth: 35, halign: 'right'}  // Replies
            },
            didDrawPage: (data) => { 
                yPos = margin + 20; 
                pageNum = data.pageNumber; 
                addPageHeaderFooter(doc, pageNum, totalPagesPlaceholder);
            } 
        });
        yPos = (doc as any).lastAutoTable.finalY ? (doc as any).lastAutoTable.finalY + 20 : yPos + 20;
    } else {
        yPos = addPageIfNeeded(yPos, 15);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
        doc.text("No detailed activity found for the selected filters.", margin, yPos); yPos += 15;
    }
    yPos += 20; 

    // Finalize page numbers
    const totalPagesActual = doc.internal.getNumberOfPages();
    for (let j = 1; j <= totalPagesActual; j++) {
      doc.setPage(j);
      addPageHeaderFooter(doc, j, totalPagesActual); // Redraw footer with actual total
    }

    doc.save(`insight_stream_reddit_aggregated_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
    toast({ title: "Aggregated PDF Report Generated", description: "Download should start shortly." });
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
      header: 'Score',
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          title="Total Usernames"
          value={formatStatNumber(summaryStats.totalUsernames)}
          icon={Users}
          iconBgClass="bg-indigo-500"
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
          title="Total Combined Score"
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
                        <CardTitle className="text-base font-medium text-muted-foreground flex items-center">
                            <BarChart3 className="mr-2 h-4 w-4" /> Profile Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                        {renderDataItem("Account Created", result.data.accountCreated ? format(parseISO(result.data.accountCreated), 'PPP') : 'N/A')}
                        {renderDataItem("Total Post Karma", result.data.totalPostKarma?.toLocaleString())}
                        {renderDataItem("Total Comment Karma", result.data.totalCommentKarma?.toLocaleString())}
                        {renderDataItem("Subreddits Active In (recent)", result.data.subredditsPostedIn?.length > 0 ? result.data.subredditsPostedIn.slice(0,3).join(', ') + (result.data.subredditsPostedIn.length > 3 ? '...' : '') : 'None found')}
                        {renderDataItem("Recent Posts Fetched Overall", result.data.totalPostsFetchedThisRun)}
                        {renderDataItem("Recent Comments Fetched Overall", result.data.totalCommentsFetchedThisRun)}
                      </CardContent>
                    </Card>
                    
                    <Accordion type="single" collapsible className="w-full" defaultValue="combined-content">
                        <AccordionItem value="combined-content">
                            <AccordionTrigger className="text-base font-medium hover:no-underline hover:text-primary focus:text-primary [&[data-state=open]]:text-primary">
                                <div className="flex items-center gap-2">
                                    <ListChecks className="h-5 w-5" /> 
                                    Fetched Posts and Comments ({filteredCombinedItems.length})
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
    

    


    



