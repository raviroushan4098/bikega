import { XMLParser } from 'fast-xml-parser';

export interface FeedEntry {
  id: string;      // Add ID for deduplication
  title: string;
  link: string;
  content: string;
  published: string;
  source: string;
}

export class FeedService {
  private parser: XMLParser;
  
  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }

  async fetchFeed(url: string): Promise<FeedEntry[]> {
    try {
      const response = await fetch(`/api/feed?url=${encodeURIComponent(url)}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const xmlText = await response.text();
      const result = this.parser.parse(xmlText);

      // Ensure entries is always an array
      const entries = result.feed?.entry || [];
      const feedTitle = result.feed?.title || 'RSS Feed';
      
      // Always treat entries as an array
      const entriesArray = Array.isArray(entries) ? entries : [entries];
      
      // Map all entries and keep duplicates (since we want all entries)
      return entriesArray.map(entry => this.transformEntry(entry, feedTitle));
    } catch (error) {
      console.error('Feed fetch error:', error);
      throw error;
    }
  }

  private transformEntry(entry: any, feedTitle: string): FeedEntry {
    return {
      id: entry?.id || entry?.guid || entry?.link?.['@_href'] || Date.now().toString(),
      title: this.cleanHtml(entry?.title?.['#text'] || entry?.title || ''),
      link: entry?.link?.['@_href'] || entry?.link || '',
      content: this.cleanHtml(entry?.content?.['#text'] || entry?.content || ''),
      published: entry?.published || entry?.updated || new Date().toISOString(),
      source: feedTitle
    };
  }

  private cleanHtml(text: string): string {
    if (!text) return '';
    
    // Remove HTML tags
    const withoutTags = text.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = withoutTags;
    
    return textarea.value.trim();
  }
}