import path from 'node:path'
import * as core from '@actions/core'
import type { FilesystemPort } from '../ports/filesystem.port.js'

export interface TerraformProjectResolverConfig {
  allProjects?: boolean
  resolveRoot?: boolean
  ignoredPaths?: string[]
  projectMarker?: string
}

export class TerraformProjectResolverService {
  constructor(private readonly filesystem: FilesystemPort) {}

  private async findFilesReferencingModule(
    modulePath: string
  ): Promise<string[]> {
    const allTfFiles = await this.filesystem.findFiles('*.tf')
    const referencingFiles: string[] = []

    for (const file of allTfFiles) {
      const fileDir = path.dirname(file)

      if (fileDir === modulePath) continue

      try {
        const content = await this.filesystem.readFile(file)

        const sourcePattern = /source\s*=\s*"([^"]+)"/g
        const matches = content.matchAll(sourcePattern)

        for (const match of matches) {
          const sourcePath = match[1]

          if (!sourcePath.startsWith('./') && !sourcePath.startsWith('../')) {
            continue
          }

          const resolvedSourcePath = path.resolve(fileDir, sourcePath)
          const resolvedModulePath = path.resolve(modulePath)

          if (resolvedSourcePath === resolvedModulePath) {
            referencingFiles.push(file)
            break
          }
        }
      } catch {
        continue
      }
    }

    return referencingFiles
  }

  private async findAllProjects(projectMarker: string): Promise<string[]> {
    const markerFiles = await this.filesystem.findFiles(projectMarker, [
      '*/module/*',
      '*/modules/*'
    ])

    return markerFiles.map((file) => path.dirname(file))
  }

  private categorizeDirectory(
    dirPath: string
  ): 'shared-module' | 'project-module' | 'direct' {
    if (dirPath.includes('modules/')) return 'shared-module'
    if (dirPath.includes('/module')) return 'project-module'
    return 'direct'
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

    const changedDirectories = Array.from(
      new Set(changedFiles.map((file) => path.dirname(file)))
    )

    core.debug(
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

      const category = this.categorizeDirectory(currentPath)

      switch (category) {
        case 'shared-module': {
          const dependentFiles =
            await this.findFilesReferencingModule(currentPath)
          const dependentDirs = Array.from(
            new Set(dependentFiles.map((f) => path.dirname(f)))
          )

          core.debug(
            `Shared module ${currentPath} → ${dependentDirs.length} dependent dir(s): ${dependentDirs.join(', ')}`
          )

          stack.push(...dependentDirs.filter((d) => !processedDirs.has(d)))
          break
        }

        case 'project-module': {
          const referencingFiles =
            await this.findFilesReferencingModule(currentPath)
          const referencingDirs = Array.from(
            new Set(referencingFiles.map((f) => path.dirname(f)))
          )

          core.debug(
            `Project module ${currentPath} → ${referencingDirs.length} referencing project(s): ${referencingDirs.join(', ')}`
          )

          projectDirectories.push(...referencingDirs)
          break
        }

        default: {
          core.debug(`Direct project: ${currentPath}`)
          projectDirectories.push(currentPath)
          break
        }
      }
    }

    return Array.from(new Set(projectDirectories))
  }
}
