
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UserSearch, Upload, FileText, BarChart3, MessageSquareText, ChevronsUpDown, Download, RefreshCw, Database } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { analyzeExternalRedditUser, type ExternalRedditUserAnalysis, type ExternalRedditUserDataItem } from '@/ai/flows/analyze-external-reddit-user-flow';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getStoredRedditAnalyses } from '@/lib/reddit-api-service';

interface AnalysisResultDisplay {
  username: string;
  data?: ExternalRedditUserAnalysis;
  error?: string;
  isLoading: boolean;
  isRefreshing?: boolean;
}

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

  useEffect(() => {
    const fetchAndSetStoredAnalyses = async () => {
        if (currentUser?.id) {
            setIsLoadingStoredData(true);
            setAnalysisResults([]); // Clear previous results
            try {
                const storedData = await getStoredRedditAnalyses(currentUser.id);
                const displayableResults: AnalysisResultDisplay[] = storedData.map(data => ({
                    username: data.username,
                    data: data,
                    isLoading: false,
                    isRefreshing: false,
                }));
                setAnalysisResults(displayableResults);
            } catch (error) {
                console.error("Error fetching stored Reddit analyses:", error);
                toast({ variant: "destructive", title: "Load Error", description: "Failed to load stored analyses." });
            } finally {
                setIsLoadingStoredData(false);
            }
        } else {
            setAnalysisResults([]);
            setIsLoadingStoredData(false); // Not logged in or no user ID
        }
    };

    if (!authLoading) { // Only run if auth state is resolved
        fetchAndSetStoredAnalyses();
    }
  }, [currentUser, authLoading, toast]);


  const processSingleUsername = async (usernameToAnalyze: string, isRefreshOp: boolean = false, appUserIdForCall: string) => {
    if (!isRefreshOp && !isUpdatingAll && !analysisResults.find(r => r.username === usernameToAnalyze && r.data)) {
        toast({ title: `${isRefreshOp ? 'Refreshing' : 'Analyzing'} User`, description: `Processing u/${usernameToAnalyze}... This may take a moment.` });
    } else if (isRefreshOp && !isUpdatingAll) {
        console.log(`Refreshing u/${usernameToAnalyze}`); // Minimal log for single refresh
    }

    try {
        const resultFromFlow = await analyzeExternalRedditUser({ username: usernameToAnalyze, appUserId: appUserIdForCall });
        setAnalysisResults(prev => prev.map(r =>
            r.username === usernameToAnalyze ? { username: usernameToAnalyze, data: resultFromFlow, isLoading: false, isRefreshing: false, error: undefined } : r
        ));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during analysis.";
        console.error(`Error analyzing/refreshing user ${usernameToAnalyze}:`, error);
        if (!isUpdatingAll) {
            toast({ variant: "destructive", title: `Analysis Failed for u/${usernameToAnalyze}`, description: errorMessage, duration: 5000 });
        }
        setAnalysisResults(prev => prev.map(r =>
            r.username === usernameToAnalyze ? { username: usernameToAnalyze, error: errorMessage, isLoading: false, isRefreshing: false, data: r.data } : r // Keep old data on error
        ));
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

    setAnalysisResults(prevResults => {
        const existingIndex = prevResults.findIndex(r => r.username === trimmedUsername);
        if (existingIndex !== -1) {
            return prevResults.map((r, idx) => 
                idx === existingIndex ? { ...r, data: r.data, isLoading: true, isRefreshing: true, error: undefined } : r
            );
        } else {
            // Add new user to the top of the list for immediate visibility
            return [{ username: trimmedUsername, isLoading: true, error: undefined }, ...prevResults];
        }
    });
    await processSingleUsername(trimmedUsername, false, currentUser.id);
    setSingleUsername(''); 
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv') {
        toast({ variant: "destructive", title: "Invalid File", description: "Please upload a .csv file." });
        setFileName(null);
        event.target.value = ''; 
        return;
      }
      setFileName(file.name);
      // Clear previous results when a new CSV is uploaded
      setAnalysisResults([]); 
      setIsLoadingStoredData(false); 

      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        if (!text) {
            toast({ variant: "destructive", title: "File Error", description: "CSV file is empty or could not be read." });
            return;
        }
        
        const lines = text.split('\n');
        if (lines.length > 0) {
          lines.shift(); // Remove the first line (header)
        }
        const usernames = lines
          .flatMap(line => line.split(',')) 
          .map(usernamePart => usernamePart.trim().replace(/^u\//i, '')) 
          .filter(username => username !== ''); 

        if (usernames.length === 0) {
          toast({ variant: "destructive", title: "No Usernames", description: "No usernames found in the CSV file after skipping the header." });
          return;
        }
        
        toast({ title: "CSV Processing", description: `Found ${usernames.length} usernames. Starting analysis...` });
        setIsProcessingCsv(true);

        const initialCsvResults: AnalysisResultDisplay[] = usernames.map(username => ({ username, isLoading: true }));
        setAnalysisResults(initialCsvResults);

        for (const username of usernames) {
            if (currentUser?.id) {
                await processSingleUsername(username, false, currentUser.id);
            }
        }
        setIsProcessingCsv(false);
        event.target.value = ''; 
        setFileName(null);
      };
      reader.onerror = () => {
        toast({ variant: "destructive", title: "File Read Error", description: "Could not read the file."});
        setFileName(null);
        event.target.value = ''; 
      }
      reader.readAsText(file);
    } else {
        setFileName(null);
    }
  };

  const handleRefreshAnalysis = async (username: string) => {
    if (!currentUser?.id) return;
    setAnalysisResults(prev => prev.map(r => 
        r.username === username ? { ...r, data: r.data, isLoading: true, isRefreshing: true, error: undefined } : r
    ));
    await processSingleUsername(username, true, currentUser.id);
  };

  const handleUpdateAll = async () => {
    if (!currentUser?.id || analysisResults.length === 0) {
        toast({ title: "Nothing to Update", description: "No analyses to update.", duration: 3000 });
        return;
    }
    setIsUpdatingAll(true);
    toast({ title: "Updating All Analyses", description: `Starting refresh for ${analysisResults.length} profiles. This may take some time.`, duration: 5000 });

    setAnalysisResults(prev => prev.map(r => ({ ...r, isLoading: true, isRefreshing: true, error: undefined })));
    
    for (const result of analysisResults) {
        await processSingleUsername(result.username, true, currentUser.id);
    }

    setIsUpdatingAll(false);
    toast({ title: "Update All Complete", description: "All displayed profiles have been refreshed." });
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

  const renderDataTable = (items: ExternalRedditUserDataItem[], type: 'Posts' | 'Comments') => {
    if (!items || items.length === 0) return <p className="text-sm text-muted-foreground py-2">No {type.toLowerCase()} found in this analysis run.</p>;
    return (
      <div className="overflow-x-auto rounded-md border mt-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[55%] whitespace-nowrap">Title / Content</TableHead>
              <TableHead className="whitespace-nowrap">Subreddit</TableHead>
              <TableHead className="whitespace-nowrap">Date</TableHead>
              <TableHead className="text-right whitespace-nowrap">Score</TableHead>
              {type === 'Posts' && <TableHead className="text-right whitespace-nowrap">Replies</TableHead>}
              <TableHead className="text-center whitespace-nowrap">Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <div className="line-clamp-2 hover:line-clamp-none transition-all max-w-sm sm:max-w-md md:max-w-lg xl:max-w-xl">
                     {item.titleOrContent}
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary" className="whitespace-nowrap">{item.subreddit}</Badge></TableCell>
                <TableCell className="whitespace-nowrap">{format(parseISO(item.timestamp), 'MMM dd, yyyy')}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{item.score.toLocaleString()}</TableCell>
                {type === 'Posts' && <TableCell className="text-right whitespace-nowrap">{item.numComments?.toLocaleString() ?? 'N/A'}</TableCell>}
                <TableCell className="text-center">
                  <Button variant="ghost" size="icon" asChild className="h-7 w-7">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" title={`Open on Reddit`}>
                      <ChevronsUpDown className="h-4 w-4 text-primary" />
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };


  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl font-headline flex items-center">
            <UserSearch className="mr-3 h-7 w-7 text-primary" />
            External Reddit User Analyzer
          </CardTitle>
          <CardDescription>
            Analyze Reddit user profiles. Results are saved and can be refreshed.
            Use the "Update All Profiles" button to refresh all currently displayed analyses.
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
                    disabled={isProcessingCsv || isUpdatingAll || analysisResults.some(r => r.isLoading)}
                    className="bg-background shadow-sm"
                />
            </div>
            <Button 
              onClick={handleAnalyzeSingleUser} 
              disabled={isProcessingCsv || isUpdatingAll || !singleUsername.trim() || analysisResults.some(r => r.isLoading)}
              className="w-full sm:w-auto"
            >
              <UserSearch className="mr-2 h-4 w-4" /> Analyze User
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
                    Upload CSV (first line is header e.g. "USER_NAME", then one username per line/comma-separated)
                </label>
                <div className="flex items-center gap-3">
                    <Input
                        id="csv-upload"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleFileUpload}
                        disabled={isProcessingCsv || isUpdatingAll || analysisResults.some(r => r.isLoading)}
                        className="flex-grow file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                    />
                    {fileName && !isProcessingCsv && (
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                            <FileText className="mr-1.5 h-3 w-3"/>{fileName}
                        </Badge>
                    )}
                </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleDownloadTemplate} variant="outline" size="sm" disabled={isProcessingCsv || isUpdatingAll || analysisResults.some(r => r.isLoading)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Template CSV
                </Button>
                 <Button onClick={handleUpdateAll} disabled={isLoadingStoredData || isUpdatingAll || isProcessingCsv || analysisResults.length === 0}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isUpdatingAll ? 'animate-spin' : ''}`} />
                    {isUpdatingAll ? 'Updating All...' : 'Update All Profiles'}
                </Button>
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

      {isLoadingStoredData && analysisResults.length === 0 && !isProcessingCsv && (
         <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p>Loading stored analyses...</p>
        </div>
      )}

      {!isLoadingStoredData && analysisResults.length === 0 && !isProcessingCsv && (
         <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground bg-card rounded-lg shadow p-6">
            <Database className="h-12 w-12 mb-3" />
            <p className="text-lg font-semibold">No Stored Analyses Found</p>
            <p>Analyze a user or upload a CSV to get started. Your results will be saved here.</p>
        </div>
      )}

      {analysisResults.length > 0 && (
        <div className="space-y-8 mt-8">
          {analysisResults.map((result, index) => (
            <Card key={`${result.username}-${index}`} className="shadow-md border border-border/70">
              <CardHeader className="bg-muted/20 rounded-t-lg p-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center">
                    <span>Analysis for: <span className="text-primary font-bold">u/{result.username}</span></span>
                    {(result.isLoading || result.isRefreshing) && <Loader2 className="ml-3 h-5 w-5 animate-spin text-primary" />}
                    </CardTitle>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRefreshAnalysis(result.username)}
                        disabled={result.isLoading || result.isRefreshing || isProcessingCsv || isUpdatingAll}
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${result.isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
                {result.data?.lastRefreshedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                        Last updated: {formatDistanceToNow(parseISO(result.data.lastRefreshedAt), { addSuffix: true })}
                    </p>
                )}
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                {(result.isLoading && !result.isRefreshing && !result.data) && ( 
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="ml-3 text-muted-foreground">Fetching data for u/{result.username}...</p>
                    </div>
                )}
                {result.error && (
                  <div className="text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                    <p className="font-medium">Error:</p>
                    <p>{result.error}</p>
                  </div>
                )}
                {result.data && (
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
                        {renderDataItem("Subreddits Active In (from recent)", result.data.subredditsPostedIn?.length > 0 ? result.data.subredditsPostedIn.join(', ') : 'None found')}
                        {renderDataItem("Recent Posts Fetched", result.data.totalPostsFetchedThisRun)}
                        {renderDataItem("Recent Comments Fetched", result.data.totalCommentsFetchedThisRun)}
                      </CardContent>
                    </Card>
                    
                    <Accordion type="multiple" className="w-full" defaultValue={['posts', 'comments']}>
                        <AccordionItem value="posts">
                            <AccordionTrigger className="text-base font-medium hover:no-underline">
                                <div className="flex items-center gap-2">
                                    <MessageSquareText className="h-5 w-5 text-primary" />
                                    Fetched Posts ({result.data.fetchedPostsDetails?.length || 0})
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                {renderDataTable(result.data.fetchedPostsDetails || [], 'Posts')}
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="comments">
                            <AccordionTrigger className="text-base font-medium hover:no-underline">
                                <div className="flex items-center gap-2">
                                    <MessageSquareText className="h-5 w-5 text-primary" />
                                    Fetched Comments ({result.data.fetchedCommentsDetails?.length || 0})
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                {renderDataTable(result.data.fetchedCommentsDetails || [], 'Comments')}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                  </div>
                )}
              </CardContent>
              {result.data && (
                <CardFooter className="p-4 bg-muted/20 rounded-b-lg text-xs text-muted-foreground justify-end">
                    <Link href={`https://www.reddit.com/user/${result.username}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                        View u/{result.username} on Reddit &rarr;
                    </Link>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
