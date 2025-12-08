import type { GitPort } from '../ports/git.port.js'

export interface FileChangeDetectorConfig {
  base?: string
  head?: string
  files?: string[]
}

export class FileChangeDetectorService {
  constructor(private readonly gitPort: GitPort) {}

  async detectChangedFiles(
    config: FileChangeDetectorConfig
  ): Promise<string[]> {
    if (config.files && config.files.length > 0) {
      return config.files
    }

    if (config.base && config.head) {
      return this.gitPort.getChangedFiles(config.base, config.head)
    }

    return this.gitPort.getChangedFilesForCurrentCommit()
  }
}
