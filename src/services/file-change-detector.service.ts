import type { GitPort } from '../ports/git.port.js'

export interface FileChangeDetectorConfig {
  base?: string
  head?: string
  files?: string[]
}

/**
 * Service for detecting changed files
 * This is the domain/application layer that uses the GitPort
 */
export class FileChangeDetectorService {
  constructor(private readonly gitPort: GitPort) {}

  /**
   * Detect changed files based on configuration
   * If files are provided manually, use those
   * Otherwise, use git to detect changes
   */
  async detectChangedFiles(
    config: FileChangeDetectorConfig
  ): Promise<string[]> {
    // If files are explicitly provided, use them
    if (config.files && config.files.length > 0) {
      return config.files
    }

    // Otherwise, detect via git
    if (config.base && config.head) {
      return this.gitPort.getChangedFiles(config.base, config.head)
    }

    // Default: get changes for current commit
    return this.gitPort.getChangedFilesForCurrentCommit()
  }
}
