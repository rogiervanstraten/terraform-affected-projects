/**
 * Port (interface) for file filtering operations
 * This defines the contract for any file filtering implementation
 */
export interface FileFilterPort {
  /**
   * Filter a list of files based on inclusion and exclusion patterns
   * @param files - Array of file paths to filter
   * @param includePatterns - Glob patterns to include (empty = include all)
   * @param excludePatterns - Glob patterns to exclude
   * @returns Filtered array of file paths
   */
  filter(
    files: string[],
    includePatterns: string[],
    excludePatterns: string[]
  ): string[]
}
