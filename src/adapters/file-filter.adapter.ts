import { minimatch } from 'minimatch'
import type { FileFilterPort } from '../ports/file-filter.port.js'

/**
 * File filter adapter using minimatch for glob pattern matching
 * Implements secure file filtering with glob patterns
 */
export class FileFilterAdapter implements FileFilterPort {
  /**
   * Check if a file matches any of the given patterns
   */
  private matchesAnyPattern(file: string, patterns: string[]): boolean {
    if (patterns.length === 0) return false

    return patterns.some((pattern) => {
      // Support negation patterns (starting with !)
      if (pattern.startsWith('!')) {
        const negatedPattern = pattern.slice(1)
        return !minimatch(file, negatedPattern, { dot: true })
      }

      return minimatch(file, pattern, { dot: true })
    })
  }

  filter(
    files: string[],
    includePatterns: string[],
    excludePatterns: string[]
  ): string[] {
    // If no files, return empty
    if (files.length === 0) return []

    // Filter logic:
    // 1. If include patterns exist, file must match at least one
    // 2. If exclude patterns exist, file must not match any
    // 3. If no include patterns, all files are included by default

    return files.filter((file) => {
      // Check exclusion first (takes precedence)
      if (excludePatterns.length > 0) {
        if (this.matchesAnyPattern(file, excludePatterns)) {
          return false
        }
      }

      // Check inclusion
      if (includePatterns.length > 0) {
        return this.matchesAnyPattern(file, includePatterns)
      }

      // No include patterns = include all (unless excluded above)
      return true
    })
  }
}
