import * as core from '@actions/core'
import { GitAdapter } from './adapters/git.adapter.js'
import { FileFilterAdapter } from './adapters/file-filter.adapter.js'
import { FilesystemAdapter } from './adapters/filesystem.adapter.js'
import { FileChangeDetectorService } from './services/file-change-detector.service.js'
import { TerraformProjectResolverService } from './services/terraform-project-resolver.service.js'

export async function run(): Promise<void> {
  try {
    core.info('Starting terraform-affected-projects action')

    const changedFilesInput: string[] = core.getMultilineInput(
      'changed-files',
      { required: false }
    )
    let baseRef: string = core.getInput('base-ref', { required: false })
    let headRef: string = core.getInput('head-ref', { required: false })

    core.debug(`Input - changed-files: ${JSON.stringify(changedFilesInput)}`)
    core.debug(`Input - base-ref: "${baseRef}"`)
    core.debug(`Input - head-ref: "${headRef}"`)
    core.debug(`GitHub event: ${process.env.GITHUB_EVENT_NAME || 'undefined'}`)
    core.debug(
      `GitHub base ref env: ${process.env.GITHUB_BASE_REF || 'undefined'}`
    )
    core.debug(
      `GitHub head ref env: ${process.env.GITHUB_HEAD_REF || 'undefined'}`
    )

    if (
      !baseRef &&
      !headRef &&
      process.env.GITHUB_EVENT_NAME === 'pull_request'
    ) {
      baseRef = `origin/${process.env.GITHUB_BASE_REF || 'main'}`
      headRef = `origin/${process.env.GITHUB_HEAD_REF || 'HEAD'}`
      core.info(
        `Detected pull request, using refs: base="${baseRef}", head="${headRef}"`
      )
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

    core.debug(`File patterns (include): ${JSON.stringify(filesPatterns)}`)
    core.debug(`File patterns (ignore): ${JSON.stringify(filesIgnorePatterns)}`)
    core.debug(`Resolve root: ${resolveRootInput}`)
    core.debug(`Ignore paths: ${JSON.stringify(ignorePathsInput)}`)

    const gitAdapter = new GitAdapter()
    const fileFilterAdapter = new FileFilterAdapter()
    const filesystemAdapter = new FilesystemAdapter()

    const fileChangeDetector = new FileChangeDetectorService(gitAdapter)
    const terraformProjectResolver = new TerraformProjectResolverService(
      filesystemAdapter
    )

    core.info(
      `Detecting changed files with refs - base: ${baseRef || 'undefined'}, head: ${headRef || 'undefined'}`
    )

    let changedFiles = await fileChangeDetector.detectChangedFiles({
      files: changedFilesInput.length > 0 ? changedFilesInput : undefined,
      base: baseRef || undefined,
      head: headRef || undefined
    })

    core.info(`Detected ${changedFiles.length} changed files`)
    core.debug(`Changed files: ${JSON.stringify(changedFiles)}`)

    changedFiles = fileFilterAdapter.filter(
      changedFiles,
      filesPatterns,
      filesIgnorePatterns
    )

    core.info(
      `After filtering: ${changedFiles.length} files (include: ${filesPatterns.length} patterns, exclude: ${filesIgnorePatterns.length} patterns)`
    )
    core.debug(`Filtered files: ${JSON.stringify(changedFiles)}`)

    const changedDirectories =
      await terraformProjectResolver.resolveAffectedProjects(changedFiles, {
        resolveRoot: resolveRootInput,
        ignoredPaths: ignorePathsInput
      })

    core.info(`Found ${changedDirectories.length} affected project(s)`)
    core.info(`Affected directories: ${JSON.stringify(changedDirectories)}`)
    core.setOutput('changed-directories', JSON.stringify(changedDirectories))
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
