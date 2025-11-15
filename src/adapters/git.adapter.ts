import { execSync } from 'node:child_process'
import * as core from '@actions/core'
import type { GitPort } from '../ports/git.port.js'

export class GitAdapter implements GitPort {
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

    const dangerousPatterns = [';', '&&', '||', '|', '$', '`', '(', ')']
    if (dangerousPatterns.some((pattern) => sanitized.includes(pattern))) {
      throw new Error(
        `Git reference contains potentially dangerous characters: "${ref}"`
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
        timeout: 30000
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
          timeout: 10000
        }
      ).trim()

      return this.executeGitDiff(mergeBase, head)
    } catch {
      try {
        return this.executeGitDiff(base, head)
      } catch {
        core.warning(
          `Unable to determine changes between ${base} and ${head}, falling back to current commit`
        )
        return this.getChangedFilesForCurrentCommit()
      }
    }
  }

  async getChangedFilesForCurrentCommit(): Promise<string[]> {
    try {
      return this.executeGitDiff('HEAD^', 'HEAD')
    } catch {
      try {
        const command = 'git show --name-only --format= HEAD'

        const output = execSync(command, {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30000
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
