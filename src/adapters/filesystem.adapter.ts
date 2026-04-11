import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { minimatch } from 'minimatch'
import type { FilesystemPort } from '../ports/filesystem.port.js'

export class FilesystemAdapter implements FilesystemPort {
  private readonly baseDir: string

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir
  }

  private async walkDirectory(
    dir: string,
    excludePaths: string[] = []
  ): Promise<string[]> {
    const files: string[] = []

    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        const relativePath = relative(this.baseDir, fullPath)

        if (
          excludePaths.some(
            (pattern) =>
              minimatch(relativePath, pattern, { dot: true }) ||
              relativePath.includes(pattern)
          )
        ) {
          continue
        }

        if (entry.isDirectory()) {
          const subFiles = await this.walkDirectory(fullPath, excludePaths)
          files.push(...subFiles)
        } else if (entry.isFile()) {
          files.push(relativePath)
        }
      }
      // eslint-disable-next-line no-empty
    } catch {}

    return files
  }

  async findFiles(
    pattern: string,
    excludePaths: string[] = []
  ): Promise<string[]> {
    const defaultExcludes = ['.git', 'node_modules', 'dist', '.terraform']
    const allExcludes = [
      ...defaultExcludes,
      ...excludePaths.filter((p) => !defaultExcludes.includes(p))
    ]

    const allFiles = await this.walkDirectory(this.baseDir, allExcludes)

    return allFiles.filter((file) => {
      const fileName = file.split('/').pop() || ''
      return fileName === pattern || minimatch(file, pattern, { dot: true })
    })
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = join(this.baseDir, filePath)
    return readFile(fullPath, 'utf-8')
  }
}
