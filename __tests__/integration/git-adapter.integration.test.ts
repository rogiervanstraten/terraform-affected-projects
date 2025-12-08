import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GitAdapter } from '../../src/adapters/git.adapter.js'
import { TestRepoHelper } from '../helpers/test-repo.helper.js'

describe('GitAdapter - Integration Test', () => {
  let repo: TestRepoHelper
  let adapter: GitAdapter
  let originalDir: string

  beforeEach(async () => {
    originalDir = process.cwd()
    repo = new TestRepoHelper()
    await repo.create()
    adapter = new GitAdapter()
    process.chdir(repo.getPath())
  })

  afterEach(async () => {
    process.chdir(originalDir)
    await repo.cleanup()
  })

  it('should detect files changed between two commits', async () => {
    await repo.writeFile('initial.tf', 'provider "aws" {}')
    const commit1 = repo.commit('Initial commit')

    await repo.writeFile('main.tf', 'resource "aws_vpc" "main" {}')
    await repo.writeFile('variables.tf', 'variable "region" {}')
    const commit2 = repo.commit('Add main and variables')

    const changedFiles = await adapter.getChangedFiles(commit1, commit2)

    expect(changedFiles).toHaveLength(2)
    expect(changedFiles).toContain('main.tf')
    expect(changedFiles).toContain('variables.tf')
    expect(changedFiles).not.toContain('initial.tf')
  })

  it('should detect modified files', async () => {
    await repo.writeFile('config.tf', 'variable "env" { default = "dev" }')
    const commit1 = repo.commit('Add config')

    await repo.writeFile('config.tf', 'variable "env" { default = "prod" }')
    const commit2 = repo.commit('Update config')

    const changedFiles = await adapter.getChangedFiles(commit1, commit2)

    expect(changedFiles).toContain('config.tf')
  })

  it('should detect changes in nested directories', async () => {
    await repo.writeFile('README.md', '# Project')
    const commit1 = repo.commit('Add README')

    await repo.writeFile('modules/vpc/main.tf', 'resource "aws_vpc" {}')
    await repo.writeFile('modules/vpc/outputs.tf', 'output "vpc_id" {}')
    await repo.writeFile('services/api/main.tf', 'module "vpc" {}')
    const commit2 = repo.commit('Add modules and services')

    const changedFiles = await adapter.getChangedFiles(commit1, commit2)

    expect(changedFiles).toContain('modules/vpc/main.tf')
    expect(changedFiles).toContain('modules/vpc/outputs.tf')
    expect(changedFiles).toContain('services/api/main.tf')
    expect(changedFiles).not.toContain('README.md')
  })

  it('should work with branch names instead of commit SHAs', async () => {
    await repo.writeFile('main.tf', 'provider "aws" {}')
    repo.commit('Initial on main')

    repo.createBranch('feature/add-vpc')
    await repo.writeFile('vpc.tf', 'resource "aws_vpc" {}')
    repo.commit('Add VPC')

    const changedFiles = await adapter.getChangedFiles(
      'main',
      'feature/add-vpc'
    )

    expect(changedFiles).toContain('vpc.tf')
  })

  it('should detect changes for the current commit', async () => {
    await repo.writeFile('old.tf', 'provider "aws" {}')
    repo.commit('Old file')

    await repo.writeFile('new.tf', 'resource "aws_vpc" {}')
    await repo.writeFile('another.tf', 'variable "name" {}')
    repo.commit('Add new files')

    const changedFiles = await adapter.getChangedFilesForCurrentCommit()

    expect(changedFiles).toContain('new.tf')
    expect(changedFiles).toContain('another.tf')
    expect(changedFiles).not.toContain('old.tf')
  })
})
