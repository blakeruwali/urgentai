import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility function to merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format timestamp to readable format
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now'
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes}m ago`
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}h ago`
  }
  
  // More than 24 hours
  const days = Math.floor(diff / 86400000)
  if (days === 1) {
    return 'Yesterday'
  }
  
  // More than 7 days, show date
  if (days > 7) {
    return date.toLocaleDateString()
  }
  
  return `${days}d ago`
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Detect if content contains code
 */
export function isCodeContent(content: string): boolean {
  const codeIndicators = [
    /```/g,                    // Code blocks
    /import\s+.*from/g,        // ES6 imports
    /function\s+\w+/g,         // Function declarations
    /const\s+\w+\s*=/g,        // Const declarations
    /interface\s+\w+/g,        // TypeScript interfaces
    /class\s+\w+/g,            // Class declarations
    /<[a-zA-Z][^>]*>/g,        // HTML/JSX tags
  ]

  const codeMatches = codeIndicators.reduce((count, pattern) => {
    return count + (content.match(pattern) || []).length
  }, 0)

  return codeMatches > 2
}

/**
 * Extract code blocks from markdown content
 */
export function extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g
  const blocks: Array<{ language: string; code: string }> = []
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim()
    })
  }

  return blocks
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
} 