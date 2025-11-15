import * as core from '@actions/core'
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
    if (config.files && config.files.length > 0) {
      core.debug(`Using manually provided files: ${config.files.length} files`)
      return config.files
    }

    if (config.base && config.head) {
      core.debug(
        `Using git diff with base="${config.base}" and head="${config.head}"`
      )
      return this.gitPort.getChangedFiles(config.base, config.head)
    }

    core.debug('Using default git detection for current commit')
    return this.gitPort.getChangedFilesForCurrentCommit()
  }
}
