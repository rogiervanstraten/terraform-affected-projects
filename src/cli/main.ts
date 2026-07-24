import { parseArgs } from 'node:util'
import { EOL } from 'node:os'
import { GitAdapter } from '../adapters/git.adapter.js'
import { FileFilterAdapter } from '../adapters/file-filter.adapter.js'
import { FilesystemAdapter } from '../adapters/filesystem.adapter.js'
import { StderrLoggerAdapter } from '../adapters/stderr-logger.adapter.js'
import { FileChangeDetectorService } from '../services/file-change-detector.service.js'
import { TerraformProjectResolverService } from '../services/terraform-project-resolver.service.js'

const DEFAULT_FILES = ['**/*.tf', '**/*.tfvars', '**/*.hcl']
const DEFAULT_IGNORE_PATHS = ['.', '.git', 'node_modules']
const DEFAULT_PROJECT_MARKER = 'provider.tf'

const HELP = `Usage: tfaf [options]

Detects affected Terraform projects in a monorepo by analyzing module
dependencies and changed files. Runs against the current working directory
(or --cwd) and prints the affected project directories to stdout.

Without --base, --changed-file or --all-projects, uncommitted changes
(staged, unstaged and untracked) are used as the change set; a clean
working tree yields no projects.

Options:
  -b, --base <ref>            Base git reference for the diff
  -H, --head <ref>            Head git reference for the diff (default: HEAD)
      --changed-file <path>   Changed file to use instead of git detection
                              (repeatable)
      --files <glob>          Include only files matching this glob
                              (repeatable, default: ${DEFAULT_FILES.join(', ')})
      --files-ignore <glob>   Exclude files matching this glob (repeatable)
      --resolve-root          Resolve all projects when root files change
  -a, --all-projects          Return all projects regardless of changes
      --project-marker <file> Filename marking a project root
                              (default: ${DEFAULT_PROJECT_MARKER})
      --ignore-path <path>    Path to ignore (repeatable,
                              default: ${DEFAULT_IGNORE_PATHS.join(', ')})
  -C, --cwd <dir>             Run as if started in <dir>
      --json                  Print a JSON array instead of one path per line
  -v, --verbose               Print debug logs to stderr
  -h, --help                  Show this help

Examples:
  tfaf --base origin/main --head HEAD
  tfaf --all-projects --json
  git diff --name-only main | xargs -n1 printf -- '--changed-file %s ' | \\
    xargs tfaf
`

interface CliOptions {
  base?: string
  head?: string
  changedFiles: string[]
  files: string[]
  filesIgnore: string[]
  resolveRoot: boolean
  allProjects: boolean
  projectMarker: string
  ignorePaths: string[]
  cwd?: string
  json: boolean
  verbose: boolean
  help: boolean
}

export function parseCliArgs(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      base: { type: 'string', short: 'b' },
      head: { type: 'string', short: 'H' },
      'changed-file': { type: 'string', multiple: true },
      files: { type: 'string', multiple: true },
      'files-ignore': { type: 'string', multiple: true },
      'resolve-root': { type: 'boolean' },
      'all-projects': { type: 'boolean', short: 'a' },
      'project-marker': { type: 'string' },
      'ignore-path': { type: 'string', multiple: true },
      cwd: { type: 'string', short: 'C' },
      json: { type: 'boolean' },
      verbose: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' }
    }
  })

  return {
    base: values.base,
    head: values.head,
    changedFiles: values['changed-file'] ?? [],
    files: values.files ?? DEFAULT_FILES,
    filesIgnore: values['files-ignore'] ?? [],
    resolveRoot: values['resolve-root'] ?? false,
    allProjects: values['all-projects'] ?? false,
    projectMarker: values['project-marker'] ?? DEFAULT_PROJECT_MARKER,
    ignorePaths: values['ignore-path'] ?? DEFAULT_IGNORE_PATHS,
    cwd: values.cwd,
    json: values.json ?? false,
    verbose: values.verbose ?? false,
    help: values.help ?? false
  }
}

async function detectUncommittedFiles(
  git: GitAdapter,
  logger: StderrLoggerAdapter
): Promise<string[]> {
  try {
    return await git.getUncommittedFiles()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.debug(`Unable to detect uncommitted changes: ${message}`)
    return []
  }
}

async function collectChangedFiles(
  options: CliOptions,
  logger: StderrLoggerAdapter
): Promise<string[]> {
  const git = new GitAdapter(logger)
  let detected: string[]

  if (options.changedFiles.length > 0) {
    detected = options.changedFiles
  } else if (options.base) {
    const detector = new FileChangeDetectorService(git)
    detected = await detector.detectChangedFiles({
      base: options.base,
      head: options.head ?? 'HEAD'
    })
  } else {
    detected = await detectUncommittedFiles(git, logger)
    logger.info(`Using ${detected.length} uncommitted change(s)`)
  }

  logger.info(`Detected ${detected.length} changed files`)

  const filtered = new FileFilterAdapter().filter(
    detected,
    options.files,
    options.filesIgnore
  )
  logger.info(`After filtering: ${filtered.length} files`)
  return filtered
}

export async function run(
  argv: string[] = process.argv.slice(2)
): Promise<void> {
  let options: CliOptions

  try {
    options = parseCliArgs(argv)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`error: ${message}${EOL}${EOL}${HELP}`)
    process.exitCode = 2
    return
  }

  if (options.help) {
    process.stdout.write(HELP)
    return
  }

  if (options.head && !options.base) {
    process.stderr.write(`error: --head requires --base${EOL}`)
    process.exitCode = 2
    return
  }

  try {
    if (options.cwd) {
      process.chdir(options.cwd)
    }

    const logger = new StderrLoggerAdapter(options.verbose)

    const allProjects = options.allProjects
    let changedFiles: string[] = []

    if (allProjects) {
      logger.info('all-projects is enabled, resolving all Terraform projects')
    } else {
      changedFiles = await collectChangedFiles(options, logger)
    }

    const resolver = new TerraformProjectResolverService(
      new FilesystemAdapter(),
      logger
    )
    const affectedProjects = await resolver.resolveAffectedProjects(
      changedFiles,
      {
        allProjects,
        resolveRoot: options.resolveRoot,
        ignoredPaths: options.ignorePaths,
        projectMarker: options.projectMarker
      }
    )

    logger.info(`Found ${affectedProjects.length} affected project(s)`)

    if (options.json) {
      process.stdout.write(`${JSON.stringify(affectedProjects)}${EOL}`)
    } else if (affectedProjects.length > 0) {
      process.stdout.write(`${affectedProjects.join(EOL)}${EOL}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`error: ${message}${EOL}`)
    process.exitCode = 1
  }
}
