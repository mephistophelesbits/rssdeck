import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import he from "he";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Decode HTML entities in a string (e.g., &#8217; -> ')
 */
export function decodeHtml(text: string | undefined | null): string {
  if (!text) return "";
  return he.decode(text);
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
