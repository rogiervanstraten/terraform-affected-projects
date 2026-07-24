import { execSync } from 'node:child_process'
import type { GitPort } from '../ports/git.port.js'
import { noopLogger, type LoggerPort } from '../ports/logger.port.js'

export class GitAdapter implements GitPort {
  constructor(private readonly logger: LoggerPort = noopLogger) {}

  private sanitizeRef(ref: string): string {
    if (!ref || typeof ref !== 'string') {
      throw new Error('Invalid git reference: must be a non-empty string')
    }

    const sanitized = ref.trim()
    const validPattern = /^[a-zA-Z0-9._\-/^~]+$/

    if (!validPattern.test(sanitized)) {
      throw new Error(
        `Invalid git reference format: "${ref}". Only alphanumeric characters, dots, hyphens, underscores, slashes, carets, and tildes are allowed.`
      )
    }

    return sanitized
  }

  private executeGitDiff(base: string, head: string): string[] {
    const sanitizedBase = this.sanitizeRef(base)
    const sanitizedHead = this.sanitizeRef(head)
    const command = `git diff --name-only ${sanitizedBase}..${sanitizedHead}`

    try {
      const output = execSync(command, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      return output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Git diff failed: ${error.message}`)
      }
      throw new Error('Git diff failed with unknown error')
    }
  }

  async getChangedFiles(base: string, head: string): Promise<string[]> {
    try {
      const mergeBase = execSync(
        `git merge-base ${this.sanitizeRef(head)} ${this.sanitizeRef(base)}`,
        {
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['ignore', 'pipe', 'pipe']
        }
      ).trim()

      return this.executeGitDiff(mergeBase, head)
    } catch {
      try {
        return this.executeGitDiff(base, head)
      } catch {
        this.logger.warning(
          `Unable to determine changes between ${base} and ${head}, falling back to current commit`
        )
        return this.getChangedFilesForCurrentCommit()
      }
    }
  }

  async getUncommittedFiles(): Promise<string[]> {
    const output = execSync('git status --porcelain --untracked-files=all', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => this.parseStatusPath(line))
  }

  private parseStatusPath(line: string): string {
    let filePath = line.slice(3)

    const renameSeparator = filePath.indexOf(' -> ')
    if (renameSeparator !== -1) {
      filePath = filePath.slice(renameSeparator + 4)
    }

    if (filePath.startsWith('"') && filePath.endsWith('"')) {
      try {
        filePath = JSON.parse(filePath)
      } catch {
        filePath = filePath.slice(1, -1)
      }
    }

    return filePath
  }

  async getChangedFilesForCurrentCommit(): Promise<string[]> {
    try {
      return this.executeGitDiff('HEAD^', 'HEAD')
    } catch {
      try {
        this.logger.debug('HEAD^ not resolvable, falling back to git show HEAD')
        const command = 'git show --name-only --format= HEAD'

        const output = execSync(command, {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30000,
          stdio: ['ignore', 'pipe', 'pipe']
        })

        return output
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      } catch {
        return []
      }
    }
  }
}
