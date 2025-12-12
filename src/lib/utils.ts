import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes different apostrophe characters into a standard single quote.
 * @param str The input string.
 * @returns The string with normalized apostrophes.
 */
export function normalizeApostrophes(str: string): string {
  if (!str) return '';
  return str.toUpperCase().replace(/[’‘ʻ]/g, "'");
}
