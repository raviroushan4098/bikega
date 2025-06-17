import { useState, useEffect, useCallback } from 'react';
import { FeedService, type FeedEntry } from '@/lib/services/feedService';
import { alertService } from '@/lib/services/alertService';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const AUTO_REFRESH_INTERVAL = 1 * 60 * 1000; // 1 minute

// Add helper function for deduplication
const deduplicateAlerts = (alerts: FeedEntry[]): FeedEntry[] => {
  const seen = new Map<string, FeedEntry>();
  
  alerts.forEach(alert => {
    // Use link as unique identifier, fallback to combination of title and published date
    const key = alert.link || `${alert.title}-${alert.published}`;
    if (!seen.has(key)) {
      seen.set(key, alert);
    }
  });

  return Array.from(seen.values());
};

interface AlertFeedState {
  data: FeedEntry[] | null;
  error: Error | null;
  isLoading: boolean;
  message?: string;
  activeAlert?: FeedEntry;
}

export function useAlertFeed(
  url: string | undefined, 
  keyword: string | undefined,
  autoRefresh: boolean = true
) {
  const [state, setState] = useState<AlertFeedState>({
    data: null,
    error: null,
    isLoading: false,
    activeAlert: undefined
  });

  const fetchAndSaveAlerts = useCallback(async () => {
    if (!url || !keyword) {
      setState(prev => ({ 
        ...prev, 
        error: new Error(!url ? 'URL is required' : 'Keyword is required'),
        message: !url ? 'Feed URL is missing' : 'Search keyword is missing'
      }));
      return;
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null, message: undefined }));
    
    try {
      // Query existing alerts
      const alertsRef = collection(db, 'alerts');
      const q = query(
        alertsRef,
        where('keyword', '==', keyword.trim()),
        orderBy('published', 'desc'),
        orderBy('__name__', 'desc')
      );
      
      const existingDocs = await getDocs(q);
      const existingAlerts = deduplicateAlerts(
        existingDocs.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        } as FeedEntry))
      );

      // Fetch new alerts
      const feedService = new FeedService();
      const newEntries = await feedService.fetchFeed(url);
      
      if (!newEntries || newEntries.length === 0) {
        setState({
          data: existingAlerts,
          error: null,
          isLoading: false,
          message: existingAlerts.length > 0 ? 'Monitoring feed for updates...' : 'Waiting for first alert...',
          activeAlert: existingAlerts[0]
        });
        return;
      }

      // Deduplicate against existing alerts using URLs
      const existingUrls = new Set(existingAlerts.map(alert => alert.link));
      const uniqueNewEntries = newEntries.filter(entry => 
        entry.link && !existingUrls.has(entry.link)
      );

      if (uniqueNewEntries.length > 0) {
        const savePromises = uniqueNewEntries.map(entry => {
          const alertData = {
            id: entry.id,
            title: entry.title || 'Untitled',
            content: entry.content || '',
            link: entry.link || '',
            published: entry.published || new Date().toISOString(),
            source: entry.source || 'RSS Feed',
            keyword: keyword.trim(),
            createdAt: new Date().toISOString() // Add timestamp for tracking
          };
          return alertService.saveUniqueAlert(alertData);
        });

        await Promise.all(savePromises);
        
        // Combine and deduplicate all alerts
        const allAlerts = deduplicateAlerts([...uniqueNewEntries, ...existingAlerts]);
        
        setState({
          data: allAlerts,
          error: null,
          isLoading: false,
          message: `Found ${uniqueNewEntries.length} new alerts`,
          activeAlert: allAlerts[0]
        });
      } else {
        setState({
          data: existingAlerts,
          error: null,
          isLoading: false,
          message: 'Feed is up to date',
          activeAlert: existingAlerts[0]
        });
      }
    } catch (error) {
      console.error('Feed fetch error:', error);
      setState(prev => ({
        data: null,
        error: error as Error,
        isLoading: false,
        message: 'Failed to fetch alerts',
        activeAlert: prev.activeAlert
      }));
    }
  }, [url, keyword]);

  useEffect(() => {
    fetchAndSaveAlerts();
    
    if (autoRefresh) {
      const interval = setInterval(fetchAndSaveAlerts, AUTO_REFRESH_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [fetchAndSaveAlerts, autoRefresh]);

  return state;
}