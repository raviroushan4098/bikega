import { useEffect, useState } from 'react';
import { FeedService, FeedEntry } from '@/lib/services/feedService';

interface AlertFeedState {
  data: FeedEntry[] | null;
  error: Error | null;
  isLoading: boolean;
}

export function useAlertFeed(url: string | undefined) {
  const [state, setState] = useState<AlertFeedState>({
    data: null,
    error: null,
    isLoading: false
  });

  useEffect(() => {
    if (!url) return;

    const feedService = new FeedService();
    let mounted = true;

    const fetchData = async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      
      try {
        const entries = await feedService.fetchFeed(url);
        if (mounted) {
          setState({
            data: entries,
            error: null,
            isLoading: false
          });
        }
      } catch (error) {
        if (mounted) {
          setState({
            data: null,
            error: error as Error,
            isLoading: false
          });
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [url]);

  return state;
}