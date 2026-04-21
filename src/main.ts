import * as core from '@actions/core'
import { GitAdapter } from './adapters/git.adapter.js'
import { FileFilterAdapter } from './adapters/file-filter.adapter.js'
import { FilesystemAdapter } from './adapters/filesystem.adapter.js'
import { FileChangeDetectorService } from './services/file-change-detector.service.js'
import { TerraformProjectResolverService } from './services/terraform-project-resolver.service.js'
import { resolveGitRefs, type GitRefs } from './git-refs.js'

interface ActionInputs {
  changedFiles: string[]
  baseRef: string
  headRef: string
  filesPatterns: string[]
  filesIgnorePatterns: string[]
  resolveRoot: boolean
  allProjects: boolean
  ignoredPaths: string[]
  projectMarker: string
}

function readInputs(): ActionInputs {
  return {
    changedFiles: core.getMultilineInput('changed-files', { required: false }),
    baseRef: core.getInput('base-ref', { required: false }),
    headRef: core.getInput('head-ref', { required: false }),
    filesPatterns: core.getMultilineInput('files', { required: false }),
    filesIgnorePatterns: core.getMultilineInput('files-ignore', {
      required: false
    }),
    resolveRoot: core.getBooleanInput('resolve-root'),
    allProjects: core.getBooleanInput('all-projects'),
    ignoredPaths: core.getMultilineInput('ignore-paths'),
    projectMarker: core.getInput('project-marker', { required: false })
  }
}

async function collectChangedFiles(
  inputs: ActionInputs,
  refs: GitRefs,
  detector: FileChangeDetectorService,
  filter: FileFilterAdapter
): Promise<string[]> {
  if (inputs.allProjects) {
    core.info('all-projects is enabled, resolving all Terraform projects')
    return []
  }

  const detected = await detector.detectChangedFiles({
    files: inputs.changedFiles.length > 0 ? inputs.changedFiles : undefined,
    base: refs.base || undefined,
    head: refs.head || undefined
  })
  core.info(`Detected ${detected.length} changed files`)

  const filtered = filter.filter(
    detected,
    inputs.filesPatterns,
    inputs.filesIgnorePatterns
  )
  core.info(`After filtering: ${filtered.length} files`)
  return filtered
}

export async function run(): Promise<void> {
  try {
    core.info('Starting terraform-affected-projects action')

    const inputs = readInputs()
    const refs = await resolveGitRefs({
      base: inputs.baseRef,
      head: inputs.headRef
    })

    const detector = new FileChangeDetectorService(new GitAdapter())
    const fileFilter = new FileFilterAdapter()
    const resolver = new TerraformProjectResolverService(
      new FilesystemAdapter()
    )

    const changedFiles = await collectChangedFiles(
      inputs,
      refs,
      detector,
      fileFilter
    )

    const affectedProjects = await resolver.resolveAffectedProjects(
      changedFiles,
      {
        allProjects: inputs.allProjects,
        resolveRoot: inputs.resolveRoot,
        ignoredPaths: inputs.ignoredPaths,
        projectMarker: inputs.projectMarker || undefined
      }
    )

    core.info(`Found ${affectedProjects.length} affected project(s)`)
    if (affectedProjects.length > 0) {
      core.info(`Affected directories: ${affectedProjects.join(', ')}`)
    }
    core.setOutput('changed-directories', JSON.stringify(affectedProjects))
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
