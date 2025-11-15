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
    } catch {
      // Skip directories we can't read
    }

    return files
  }

  async findFiles(
    pattern: string,
    excludePaths: string[] = []
  ): Promise<string[]> {
    const allFiles = await this.walkDirectory(this.baseDir, excludePaths)

    return allFiles.filter((file) => {
      const fileName = file.split('/').pop() || ''
      return fileName === pattern || minimatch(file, pattern, { dot: true })
    })
  }

  async searchFileContents(
    searchText: string,
    filePattern?: string,
    wordMatch: boolean = false
  ): Promise<string[]> {
    const allFiles = await this.walkDirectory(this.baseDir, [
      'node_modules',
      '.git',
      'dist'
    ])

    const filesToSearch = filePattern
      ? allFiles.filter((file) => minimatch(file, filePattern, { dot: true }))
      : allFiles

    const matchingFiles: string[] = []

    for (const file of filesToSearch) {
      try {
        const content = await this.readFile(file)

        let matches = false
        if (wordMatch) {
          const regex = new RegExp(`\\b${this.escapeRegex(searchText)}\\b`, 'g')
          matches = regex.test(content)
        } else {
          matches = content.includes(searchText)
        }

        if (matches) {
          matchingFiles.push(file)
        }
      } catch {
        continue
      }
    }

    return matchingFiles
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = join(this.baseDir, filePath)
    return readFile(fullPath, 'utf-8')
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}
