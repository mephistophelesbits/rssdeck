/**
 * OPML (Outline Processor Markup Language) Parser
 * Used for importing RSS feed subscriptions from other readers
 */

export interface OPMLOutline {
  text: string;
  title?: string;
  type?: string;
  xmlUrl?: string;
  htmlUrl?: string;
  children?: OPMLOutline[];
}

export interface OPMLFeed {
  title: string;
  url: string;
  category?: string;
}

export interface OPMLParseResult {
  feeds: OPMLFeed[];
  categories: string[];
}

/**
 * Parse OPML XML string into structured feed data
 */
export function parseOPML(xmlString: string): OPMLParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  
  const feeds: OPMLFeed[] = [];
  const categories = new Set<string>();
  
  // Parse outlines
  const outlines = doc.querySelectorAll('outline');
  
  outlines.forEach((outline) => {
    const xmlUrl = outline.getAttribute('xmlUrl') || outline.getAttribute('rss');
    if (xmlUrl) {
      const text = outline.getAttribute('text') || outline.getAttribute('title') || 'Untitled';
      const title = outline.getAttribute('title') || text;
      
      // Find parent outline for category
      let category: string | undefined;
      let parent = outline.parentElement;
      while (parent) {
        if (parent.tagName === 'outline') {
          const parentText = parent.getAttribute('text') || parent.getAttribute('title');
          if (parentText && !parent.getAttribute('xmlUrl')) {
            category = parentText;
            break;
          }
        }
        parent = parent.parentElement;
      }
      
      feeds.push({
        title,
        url: xmlUrl,
        category,
      });
      
      if (category) {
        categories.add(category);
      }
    }
  });
  
  return {
    feeds,
    categories: Array.from(categories),
  };
}

/**
 * Validate if a string is valid OPML XML
 */
export function isValidOPML(xmlString: string): boolean {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const errorNode = doc.querySelector('parsererror');
    if (errorNode) return false;
    
    // Check if it has outline elements
    const outlines = doc.querySelectorAll('outline[xmlUrl], outline[rss]');
    return outlines.length > 0;
  } catch {
    return false;
  }
}

/**
 * Generate OPML XML from feeds
 */
export function generateOPML(feeds: OPMLFeed[], title: string = 'RSS Deck Exports'): string {
  const categories = new Map<string, OPMLFeed[]>();
  
  // Group feeds by category
  feeds.forEach((feed) => {
    const cat = feed.category || 'Uncategorized';
    if (!categories.has(cat)) {
      categories.set(cat, []);
    }
    categories.get(cat)!.push(feed);
  });
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${title}</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>`;
  
  categories.forEach((categoryFeeds, category) => {
    if (category !== 'Uncategorized') {
      xml += `\n    <outline text="${category}" title="${category}">`;
    }
    
    categoryFeeds.forEach((feed) => {
      xml += `\n      <outline text="${feed.title}" title="${feed.title}" type="rss" xmlUrl="${feed.url}" htmlUrl=""/>`;
    });
    
    if (category !== 'Uncategorized') {
      xml += '\n    </outline>';
    }
  });
  
  xml += '\n  </body>\n</opml>';
  
  return xml;
}
