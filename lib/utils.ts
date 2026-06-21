import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Parse citation marker contents like "1", "1, 3", "1-3", "1–3" into number list.
export function parseCitationNumbers(content: string): number[] {
  const out: number[] = [];
  for (const part of content.split(',')) {
    const trimmed = part.trim();
    const range = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const start = parseInt(range[1], 10);
      const end = parseInt(range[2], 10);
      for (let i = start; i <= Math.min(end, start + 20); i++) out.push(i);
    } else {
      const n = parseInt(trimmed, 10);
      if (!isNaN(n)) out.push(n);
    }
  }
  return out;
}
