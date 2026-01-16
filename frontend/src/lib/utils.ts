import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// URL regex pattern - matches http(s), ftp, and common domain patterns
const URL_REGEX = /(?:https?:\/\/|ftp:\/\/)[^\s]+|(?:www\.[^\s]+)/gi

export interface LinkPart {
  type: 'text' | 'link';
  content: string;
  url?: string;
}

/**
 * Parse comment text and identify URLs
 * Returns an array of text/link parts for rendering
 */
export function parseCommentWithLinks(text: string): LinkPart[] {
  if (!text) return [];

  const parts: LinkPart[] = [];
  let lastIndex = 0;
  let match;

  // Reset regex
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    // Add the link
    let url = match[0];
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ftp://')) {
      url = 'https://' + url;
    }
    
    parts.push({
      type: 'link',
      content: match[0], // Original text
      url: url
    });

    lastIndex = URL_REGEX.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return parts.length === 0 ? [{ type: 'text', content: text }] : parts;
}