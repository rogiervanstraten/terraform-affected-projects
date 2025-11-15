/**
 * Port (interface) for filesystem operations
 * This defines the contract for any filesystem implementation
 */
export interface FilesystemPort {
  /**
   * Recursively find all files matching a pattern, excluding certain paths
   * @param pattern - Glob pattern or filename to match
   * @param excludePaths - Array of path patterns to exclude
   * @returns Array of file paths
   */
  findFiles(pattern: string, excludePaths?: string[]): Promise<string[]>

  /**
   * Search file contents for a specific text pattern
   * @param searchText - Text to search for
   * @param filePattern - Only search files matching this pattern (e.g., '*.tf')
   * @param wordMatch - If true, match whole words only
   * @returns Array of file paths containing the search text
   */
  searchFileContents(
    searchText: string,
    filePattern?: string,
    wordMatch?: boolean
  ): Promise<string[]>

  /**
   * Read file contents
   * @param filePath - Path to the file
   * @returns File contents as string
   */
  readFile(filePath: string): Promise<string>
}
