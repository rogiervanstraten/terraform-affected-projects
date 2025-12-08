import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'

/**
 * Helper for creating temporary git repositories for integration tests
 */
export class TestRepoHelper {
  private tempDir: string | null = null

  /**
   * Create a new temporary git repository
   */
  async create(): Promise<string> {
    this.tempDir = await mkdtemp(join(tmpdir(), 'terraform-test-'))

    // Initialize git repo
    this.exec('git init')
    this.exec('git config user.email "test@example.com"')
    this.exec('git config user.name "Test User"')

    // Create initial commit (required for diffs)
    await writeFile(join(this.tempDir, '.gitkeep'), '')
    this.exec('git add .')
    this.exec('git commit -m "Initial commit"')

    return this.tempDir
  }

  /**
   * Write a file to the repo
   */
  async writeFile(path: string, content: string): Promise<void> {
    if (!this.tempDir) throw new Error('Repository not created')

    const fullPath = join(this.tempDir, path)
    const dirPath = join(fullPath, '..')

    // Always create parent directories
    await mkdir(dirPath, { recursive: true })

    await writeFile(fullPath, content)
  }

  /**
   * Create multiple files at once
   */
  async writeFiles(files: Record<string, string>): Promise<void> {
    for (const [path, content] of Object.entries(files)) {
      await this.writeFile(path, content)
    }
  }

  /**
   * Commit changes
   */
  commit(message: string = 'Test commit'): string {
    if (!this.tempDir) throw new Error('Repository not created')

    this.exec('git add .')
    this.exec(`git commit -m "${message}"`)

    return this.exec('git rev-parse HEAD')
  }

  /**
   * Get current HEAD SHA
   */
  getHead(): string {
    return this.exec('git rev-parse HEAD')
  }

  /**
   * Create and checkout a new branch
   */
  createBranch(name: string): void {
    this.exec(`git checkout -b ${name}`)
  }

  /**
   * Checkout a branch or commit
   */
  checkout(ref: string): void {
    this.exec(`git checkout ${ref}`)
  }

  /**
   * Get the temp directory path
   */
  getPath(): string {
    if (!this.tempDir) throw new Error('Repository not created')
    return this.tempDir
  }

  /**
   * Execute git command in the temp directory
   */
  private exec(command: string): string {
    if (!this.tempDir) throw new Error('Repository not created')

    return execSync(command, {
      cwd: this.tempDir,
      encoding: 'utf-8'
    }).trim()
  }

  /**
   * Clean up the temporary directory
   */
  async cleanup(): Promise<void> {
    if (this.tempDir) {
      await rm(this.tempDir, { recursive: true, force: true })
      this.tempDir = null
    }
  }
}
