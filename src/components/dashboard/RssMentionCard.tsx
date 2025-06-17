import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ExternalLink, Clock, Hash, Globe, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAlertFeed } from '@/hooks/useAlertFeed';

interface Mention {
  id: string;
  platform: string;
  title?: string;
  source?: string;
  url?: string;
  excerpt?: string;
  timestamp?: string;
  matchedKeyword?: string | null;
  xmlContent?: string | null;
  hasXmlContent?: boolean;
}

interface RssMentionCardProps {
  mention: Mention;
}

// Add default values for common properties
const getDefaultMentionProps = (mention: Mention): Required<Omit<Mention, 'xmlContent' | 'hasXmlContent'>> & Pick<Mention, 'xmlContent' | 'hasXmlContent'> => ({
  id: mention.id,
  platform: mention.platform,
  title: mention.title ?? 'Untitled',
  source: mention.source ?? 'RSS Feed',
  url: mention.url ?? '#',
  excerpt: mention.excerpt ?? 'No content available',
  timestamp: mention.timestamp ?? new Date().toISOString(),
  matchedKeyword: mention.matchedKeyword ?? null,
  xmlContent: mention.xmlContent ?? null,
  hasXmlContent: mention.hasXmlContent ?? false
});

interface ParsedXmlContent {
  title: string;
  link: string;
  content: string;
  published: string;
}

const parseXmlContent = (xmlString: string): ParsedXmlContent | null => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString.trim(), 'text/xml');

    // Find the entry element
    const entry = xmlDoc.querySelector('entry');
    if (!entry) return null;

    // Extract data from XML
    const title = entry.querySelector('title')?.textContent?.replace(/<\/?b>/g, '') || '';
    const link = entry.querySelector('link')?.getAttribute('href') || '';
    const content = entry.querySelector('content')?.textContent?.replace(/<\/?b>/g, '') || '';
    const published = entry.querySelector('published')?.textContent || '';

    return {
      title,
      link,
      content,
      published
    };
  } catch (error) {
    console.error('XML parsing error:', error);
    return null;
  }
};

export default function RssMentionCard({ mention: rawMention }: RssMentionCardProps) {
  const mention = React.useMemo(
    () => getDefaultMentionProps(rawMention),
    [rawMention]
  );

  const { data: alerts, error, isLoading, message } = useAlertFeed(
    mention.url,
    mention.matchedKeyword
  );

  if (isLoading) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <span className="loading loading-spinner loading-sm" />
            <span>Checking for new alerts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !alerts || alerts.length === 0) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>{message || error?.message || 'No alerts found'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Display all alerts in a stack
  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <Card key={alert.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Globe className="h-3 w-3" />
              <span>{alert.source}</span>
              {mention.matchedKeyword && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <Hash className="h-3 w-3" />
                  <span>{mention.matchedKeyword}</span>
                </>
              )}
            </div>
            <a
              href={alert.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-medium hover:underline inline-flex items-start gap-2 group"
            >
              {alert.title}
              <ExternalLink className="h-4 w-4 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <p className={cn("text-sm text-muted-foreground", "line-clamp-3")}>
              {alert.content}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <time dateTime={alert.published}>
                {formatDistanceToNow(new Date(alert.published), { addSuffix: true })}
              </time>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Example mention object
const mention: Mention = {
  id: 'google-alert-1',
  platform: 'RSS Feed',
  source: 'Google Alerts',
  xmlContent: `<feed xmlns="http://www.w3.org/2005/Atom">...</feed>`,
  hasXmlContent: true
};