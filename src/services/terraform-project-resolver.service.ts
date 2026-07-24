import path from 'node:path'
import type { FilesystemPort } from '../ports/filesystem.port.js'
import { noopLogger, type LoggerPort } from '../ports/logger.port.js'

export interface TerraformProjectResolverConfig {
  allProjects?: boolean
  resolveRoot?: boolean
  ignoredPaths?: string[]
  projectMarker?: string
}

const MODULE_SEGMENT = /modules?$/
const MODULE_EXCLUDE_PATTERNS = ['**/*module/**', '**/*modules/**']

export class TerraformProjectResolverService {
  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly logger: LoggerPort = noopLogger
  ) {}

  private extractGitSourceLocalPath(sourcePath: string): string | null {
    let url = sourcePath

    if (url.startsWith('git::')) {
      url = url.slice('git::'.length)
      // Strip the scheme (https://, ssh://, etc.) so the first // we find
      // is the subdir separator, not the protocol separator.
      const schemeEnd = url.indexOf('://')
      if (schemeEnd !== -1) url = url.slice(schemeEnd + 3)
    } else if (
      /^github\.com\//.test(url) ||
      /^bitbucket\.org\//.test(url) ||
      /^gitlab\.com\//.test(url)
    ) {
      // Registry shorthand — no scheme to strip
    } else {
      return null
    }

    const subdirIdx = url.indexOf('//')
    if (subdirIdx === -1) return null

    const subpath = url.slice(subdirIdx + 2)

    // Pinned refs (?ref=v1.0.0) are skipped — a change to the .tf file that
    // bumps the ref is what triggers detection for pinned consumers.
    if (subpath.includes('?')) return null

    return subpath || null
  }

  private async findFilesReferencingModule(
    modulePath: string
  ): Promise<string[]> {
    const allTfFiles = await this.filesystem.findFiles('*.tf')
    const referencingFiles: string[] = []
    const resolvedModulePath = path.resolve(modulePath)

    for (const file of allTfFiles) {
      const fileDir = path.dirname(file)

      if (fileDir === modulePath) continue

      try {
        const content = await this.filesystem.readFile(file)

        const sourcePattern = /source\s*=\s*"([^"]+)"/g
        const matches = content.matchAll(sourcePattern)

        for (const match of matches) {
          const sourcePath = match[1]

          if (sourcePath.startsWith('./') || sourcePath.startsWith('../')) {
            const resolvedSourcePath = path.resolve(fileDir, sourcePath)

            if (
              resolvedSourcePath === resolvedModulePath ||
              resolvedModulePath.startsWith(`${resolvedSourcePath}${path.sep}`)
            ) {
              referencingFiles.push(file)
              break
            }
            continue
          }

          const gitLocalPath = this.extractGitSourceLocalPath(sourcePath)
          if (gitLocalPath !== null) {
            const resolvedGitPath = path.resolve(gitLocalPath)

            if (
              resolvedGitPath === resolvedModulePath ||
              resolvedModulePath.startsWith(`${resolvedGitPath}${path.sep}`)
            ) {
              referencingFiles.push(file)
              break
            }
          }
        }
      } catch {
        continue
      }
    }

    return referencingFiles
  }

  private async findDirsReferencingModule(
    modulePath: string
  ): Promise<string[]> {
    const referencingFiles = await this.findFilesReferencingModule(modulePath)
    return Array.from(new Set(referencingFiles.map((f) => path.dirname(f))))
  }

  private async findAllProjects(projectMarker: string): Promise<string[]> {
    const markerFiles = await this.filesystem.findFiles(
      projectMarker,
      MODULE_EXCLUDE_PATTERNS
    )

    return markerFiles.map((file) => path.dirname(file))
  }

  private isModuleDirectory(dirPath: string): boolean {
    return dirPath.split('/').some((segment) => MODULE_SEGMENT.test(segment))
  }

  private findProjectRoot(
    dir: string,
    projectDirs: Set<string>,
    ignoredPaths: string[]
  ): string | null {
    let current = dir

    while (current && current !== '.' && !ignoredPaths.includes(current)) {
      if (projectDirs.has(current)) return current
      current = path.dirname(current)
    }

    return null
  }

  async resolveAffectedProjects(
    changedFiles: string[],
    config: TerraformProjectResolverConfig = {}
  ): Promise<string[]> {
    const {
      allProjects = false,
      resolveRoot = false,
      ignoredPaths = ['.'],
      projectMarker = 'provider.tf'
    } = config

    if (allProjects) {
      return this.findAllProjects(projectMarker)
    }

    const projectDirectories: string[] = []
    const processedDirs = new Set<string>()
    let knownProjectDirs: Set<string> | undefined

    const changedDirectories = Array.from(
      new Set(changedFiles.map((file) => path.dirname(file)))
    )

    this.logger.debug(
      `Discovered ${changedDirectories.length} changed directories: ${changedDirectories.join(', ')}`
    )

    const stack = [...changedDirectories]

    while (stack.length > 0) {
      const currentPath = stack.pop()!

      if (processedDirs.has(currentPath)) {
        continue
      }
      processedDirs.add(currentPath)

      if (currentPath === '.' && resolveRoot) {
        const rootProjects = await this.findAllProjects(projectMarker)
        return Array.from(new Set([...projectDirectories, ...rootProjects]))
      }

      if (!currentPath || ignoredPaths.includes(currentPath)) {
        continue
      }

      if (this.isModuleDirectory(currentPath)) {
        const dependentDirs = await this.findDirsReferencingModule(currentPath)

        this.logger.debug(
          `Module ${currentPath} → ${dependentDirs.length} referencing dir(s): ${dependentDirs.join(', ')}`
        )

        stack.push(...dependentDirs.filter((d) => !processedDirs.has(d)))
        continue
      }

      knownProjectDirs ??= new Set(await this.findAllProjects(projectMarker))
      const projectRoot = this.findProjectRoot(
        currentPath,
        knownProjectDirs,
        ignoredPaths
      )

      if (projectRoot) {
        this.logger.debug(`Direct project: ${currentPath} → ${projectRoot}`)
        projectDirectories.push(projectRoot)
      } else {
        this.logger.debug(
          `Skipped ${currentPath}: no ${projectMarker} found in directory or its parents`
        )
      }
    }

    return Array.from(new Set(projectDirectories))
  }
}
