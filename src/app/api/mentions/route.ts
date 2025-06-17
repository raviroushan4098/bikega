import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

interface AlertEntry {
  id: string;
  title: string;
  link: { '@_href': string };
  published: string;
  content: string;
}

interface ParsedAlert {
  feed: {
    title: string;
    entry: AlertEntry[];
  }
}

async function fetchAlertXml(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/xml',
        'User-Agent': 'Mozilla/5.0' // Some feeds require a user agent
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    
    return parser.parse(xmlText) as ParsedAlert;
  } catch (error) {
    console.error('Error fetching XML:', error);
    throw error;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedUrl = searchParams.get('url');

  if (!feedUrl) {
    return NextResponse.json(
      { error: 'Feed URL is required' },
      { status: 400 }
    );
  }

  try {
    const parsedData = await fetchAlertXml(feedUrl);
    return NextResponse.json(parsedData);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch feed' },
      { status: 500 }
    );
  }
}