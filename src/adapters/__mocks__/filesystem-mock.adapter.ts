import { minimatch } from 'minimatch'
import type { FilesystemPort } from '../../ports/filesystem.port.js'

export type MockFilesystem = Record<string, string>

export class MockFilesystemAdapter implements FilesystemPort {
  constructor(private readonly files: MockFilesystem) {}

  async findFiles(
    pattern: string,
    excludePaths: string[] = []
  ): Promise<string[]> {
    const allFiles = Object.keys(this.files)

    const nonExcluded = allFiles.filter((file) => {
      return !excludePaths.some(
        (excludePattern) =>
          minimatch(file, excludePattern, { dot: true }) ||
          file.includes(excludePattern)
      )
    })

    return nonExcluded.filter((file) => {
      const fileName = file.split('/').pop() || ''
      return (
        fileName === pattern ||
        minimatch(file, pattern, { dot: true, matchBase: true })
      )
    })
  }

  async readFile(filePath: string): Promise<string> {
    if (!(filePath in this.files)) {
      throw new Error(`File not found: ${filePath}`)
    }
    return this.files[filePath]
  }
}
