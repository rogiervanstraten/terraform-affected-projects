export interface GitPort {
  getChangedFiles(base: string, head: string): Promise<string[]>

  getChangedFilesForCurrentCommit(): Promise<string[]>
}
