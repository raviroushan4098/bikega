interface ParsedRssEntry {
  id: string;
  title: string;
  link: string;
  published: string;
  updated: string;
  content: string;
  author?: string;
}

export function parseRssXmlEntry(xmlString: string): ParsedRssEntry | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    // Get the entry element
    const entry = xmlDoc.querySelector('entry');
    if (!entry) return null;

    return {
      id: entry.querySelector('id')?.textContent || '',
      title: entry.querySelector('title')?.textContent || '',
      link: entry.querySelector('link')?.getAttribute('href') || '',
      published: entry.querySelector('published')?.textContent || '',
      updated: entry.querySelector('updated')?.textContent || '',
      content: entry.querySelector('content')?.textContent || '',
      author: entry.querySelector('author name')?.textContent || undefined
    };
  } catch (error) {
    console.error('Error parsing RSS XML:', error);
    return null;
  }
}