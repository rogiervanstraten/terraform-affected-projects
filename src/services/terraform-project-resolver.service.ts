import path from 'node:path'
import type { FilesystemPort } from '../ports/filesystem.port.js'
import { DependencyResolverTelemetry } from '../utils/dependency-resolver-telemetry.util.js'

export interface TerraformProjectResolverConfig {
  resolveRoot?: boolean
  ignoredPaths?: string[]
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

  private async findFilesUsingModulePath(
    modulePath: string
  ): Promise<string[]> {
    return await this.filesystem.searchFileContents(
      modulePath,
      '**/*.tf',
      false
    )
  }

  private async findAllProjects(): Promise<string[]> {
    const providerFiles = await this.filesystem.findFiles('provider.tf', [
      '*/module/*',
      '*/modules/*'
    ])

    return providerFiles.map((file) => path.dirname(file))
  }

  private categorizeDirectory(dirPath: string): {
    type: 'shared-module' | 'project-module' | 'project' | 'other'
    hasProvider: boolean
  } {
    const isInSharedModules = dirPath.includes('modules/')
    const isProjectModule = dirPath.includes('/module') && !isInSharedModules
    const parts = dirPath.split('/')
    const isLikelyProject =
      parts.includes('production') ||
      parts.includes('staging') ||
      parts.includes('development')

    return {
      type: isInSharedModules
        ? 'shared-module'
        : isProjectModule
          ? 'project-module'
          : isLikelyProject
            ? 'project'
            : 'other',
      hasProvider: false
    }
  }

  async resolveAffectedProjects(
    changedFiles: string[],
    config: TerraformProjectResolverConfig = {}
  ): Promise<string[]> {
    const { resolveRoot = false, ignoredPaths = ['.'] } = config

    const telemetry = new DependencyResolverTelemetry()
    const projectDirectories: string[] = []
    const processedDirs = new Set<string>()

    const changedDirectories = Array.from(
      new Set(changedFiles.map((file) => path.dirname(file)))
    )

    telemetry.recordDiscovered(changedDirectories)

    const stack = [...changedDirectories]

    while (stack.length > 0) {
      const currentPath = stack.pop()!

      if (processedDirs.has(currentPath)) {
        continue
      }
      processedDirs.add(currentPath)

      if (currentPath === '.' && resolveRoot) {
        return await this.findAllProjects()
      }

      if (!currentPath || ignoredPaths.includes(currentPath)) {
        continue
      }

      const category = this.categorizeDirectory(currentPath)

      switch (category.type) {
        case 'shared-module': {
          const dependentFiles =
            await this.findFilesUsingModulePath(currentPath)
          const dependentDirs = Array.from(
            new Set(dependentFiles.map((f) => path.dirname(f)))
          )

          telemetry.recordModuleDependency(dependentDirs)

          stack.push(...dependentDirs.filter((d) => !processedDirs.has(d)))
          break
        }

        case 'project-module': {
          const referencingFiles =
            await this.findFilesReferencingModule(currentPath)
          const referencingDirs = Array.from(
            new Set(referencingFiles.map((f) => path.dirname(f)))
          )

          telemetry.recordProjectDependency(referencingDirs)

          projectDirectories.push(...referencingDirs)
          break
        }

        case 'project':
        case 'other':
        default: {
          telemetry.recordDirectProject(currentPath)
          projectDirectories.push(currentPath)
          break
        }
      }
    }

    telemetry.outputToDebugLogs()

    return Array.from(new Set(projectDirectories))
  }
}
