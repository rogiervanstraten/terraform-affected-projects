/**
 * Port (interface) for Git operations
 * This defines the contract for any Git implementation
 */
export interface GitPort {
  /**
   * Get the list of changed files between two git references
   * @param base - Base commit SHA or ref (e.g., 'HEAD^', commit SHA)
   * @param head - Head commit SHA or ref (e.g., 'HEAD', commit SHA)
   * @returns Array of changed file paths
   */
  getChangedFiles(base: string, head: string): Promise<string[]>

  /**
   * Get changed files for the current commit
   * @returns Array of changed file paths
   */
  getChangedFilesForCurrentCommit(): Promise<string[]>
}
