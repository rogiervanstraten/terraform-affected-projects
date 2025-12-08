import { minimatch } from 'minimatch'
import type { FileFilterPort } from '../ports/file-filter.port.js'

export class FileFilterAdapter implements FileFilterPort {
  private matchesAnyPattern(file: string, patterns: string[]): boolean {
    if (patterns.length === 0) return false

    return patterns.some((pattern) => {
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
    if (files.length === 0) return []

    return files.filter((file) => {
      if (excludePatterns.length > 0) {
        if (this.matchesAnyPattern(file, excludePatterns)) {
          return false
        }
      }

      if (includePatterns.length > 0) {
        return this.matchesAnyPattern(file, includePatterns)
      }

      return true
    })
  }
}
