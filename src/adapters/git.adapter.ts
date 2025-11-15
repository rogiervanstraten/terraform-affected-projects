import { execSync } from 'node:child_process'
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

    try {
      const output = execSync(
        `git diff --name-only ${sanitizedBase}..${sanitizedHead}`,
        {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30000
        }
      )

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
    return this.executeGitDiff(base, head)
  }

  async getChangedFilesForCurrentCommit(): Promise<string[]> {
    return this.executeGitDiff('HEAD^', 'HEAD')
  }
}
