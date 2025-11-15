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
      {
        required: false
      }
    )

    let baseRef: string = core.getInput('base-ref', { required: false })
    let headRef: string = core.getInput('head-ref', { required: false })

    if (
      !baseRef &&
      !headRef &&
      process.env.GITHUB_EVENT_NAME === 'pull_request'
    ) {
      try {
        const event = process.env.GITHUB_EVENT_PATH
        if (event) {
          const fs = await import('node:fs')
          const eventData = JSON.parse(fs.readFileSync(event, 'utf8'))

          if (eventData.pull_request) {
            baseRef = eventData.pull_request.base.sha
            headRef = eventData.pull_request.head.sha || 'HEAD'
            core.info(`Using PR SHAs - base: ${baseRef}, head: ${headRef}`)
          } else {
            throw new Error('No pull_request data in event')
          }
        } else {
          throw new Error('No GITHUB_EVENT_PATH')
        }
      } catch (error) {
        core.debug(`Failed to parse PR event data: ${error}`)
        core.info('Falling back to environment variables')

        const baseBranch = process.env.GITHUB_BASE_REF || 'main'

        baseRef = `remotes/origin/${baseBranch}`
        headRef = 'HEAD'

        core.info(`Using branch refs - base: ${baseRef}, head: ${headRef}`)
      }
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

    let changedFiles = await fileChangeDetector.detectChangedFiles({
      files: changedFilesInput.length > 0 ? changedFilesInput : undefined,
      base: baseRef || undefined,
      head: headRef || undefined
    })

    core.info(`Detected ${changedFiles.length} changed files`)

    changedFiles = fileFilterAdapter.filter(
      changedFiles,
      filesPatterns,
      filesIgnorePatterns
    )

    core.info(`After filtering: ${changedFiles.length} files`)

    const changedDirectories =
      await terraformProjectResolver.resolveAffectedProjects(changedFiles, {
        resolveRoot: resolveRootInput,
        ignoredPaths: ignorePathsInput
      })

    core.info(`Found ${changedDirectories.length} affected project(s)`)
    if (changedDirectories.length > 0) {
      core.info(`Affected directories: ${changedDirectories.join(', ')}`)
    }
    core.setOutput('changed-directories', JSON.stringify(changedDirectories))
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
