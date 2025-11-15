import * as core from '@actions/core'
import { GitAdapter } from './adapters/git.adapter.js'
import { FileFilterAdapter } from './adapters/file-filter.adapter.js'
import { FilesystemAdapter } from './adapters/filesystem.adapter.js'
import { FileChangeDetectorService } from './services/file-change-detector.service.js'
import { TerraformProjectResolverService } from './services/terraform-project-resolver.service.js'

export async function run(): Promise<void> {
  try {
    const changedFilesInput: string[] = core.getMultilineInput(
      'changed-files',
      { required: false }
    )
    let baseRef: string = core.getInput('base-ref', { required: false })
    let headRef: string = core.getInput('head-ref', { required: false })

    if (
      !baseRef &&
      !headRef &&
      process.env.GITHUB_EVENT_NAME === 'pull_request'
    ) {
      baseRef = `origin/${process.env.GITHUB_BASE_REF || 'main'}`
      headRef = `origin/${process.env.GITHUB_HEAD_REF || 'HEAD'}`
    }

    const filesPatterns: string[] = core.getMultilineInput('files', {
      required: false
    })
    const filesIgnorePatterns: string[] = core.getMultilineInput(
      'files-ignore',
      { required: false }
    )
    const resolveRootInput: boolean = core.getBooleanInput('resolve-root')
    const ignorePathsInput: string[] = core.getMultilineInput('ignore-paths')

    const gitAdapter = new GitAdapter()
    const fileFilterAdapter = new FileFilterAdapter()
    const filesystemAdapter = new FilesystemAdapter()

    const fileChangeDetector = new FileChangeDetectorService(gitAdapter)
    const terraformProjectResolver = new TerraformProjectResolverService(
      filesystemAdapter
    )

    core.debug(
      `Using refs - base: ${baseRef || 'undefined'}, head: ${headRef || 'undefined'}`
    )
    core.debug(`GitHub event: ${process.env.GITHUB_EVENT_NAME || 'undefined'}`)

    let changedFiles = await fileChangeDetector.detectChangedFiles({
      files: changedFilesInput.length > 0 ? changedFilesInput : undefined,
      base: baseRef || undefined,
      head: headRef || undefined
    })

    core.debug(`Detected ${changedFiles.length} changed files`)

    changedFiles = fileFilterAdapter.filter(
      changedFiles,
      filesPatterns,
      filesIgnorePatterns
    )

    core.debug(
      `After filtering: ${changedFiles.length} files (include: ${filesPatterns.length} patterns, exclude: ${filesIgnorePatterns.length} patterns)`
    )

    const changedDirectories =
      await terraformProjectResolver.resolveAffectedProjects(changedFiles, {
        resolveRoot: resolveRootInput,
        ignoredPaths: ignorePathsInput
      })

    core.info(`Found ${changedDirectories.length} affected project(s)`)
    core.setOutput('changed-directories', JSON.stringify(changedDirectories))
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
