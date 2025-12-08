import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FilesystemAdapter } from '../../src/adapters/filesystem.adapter.js'
import { TestRepoHelper } from '../helpers/test-repo.helper.js'
import { TerraformTemplates } from '../helpers/test-files.helper.js'

describe('FilesystemAdapter - Integration Test', () => {
  let repo: TestRepoHelper
  let adapter: FilesystemAdapter

  beforeEach(async () => {
    repo = new TestRepoHelper()
    const repoPath = await repo.create()
    adapter = new FilesystemAdapter(repoPath)
  })

  afterEach(async () => {
    await repo.cleanup()
  })

  it('should find Terraform files', async () => {
    await repo.writeFile('main.tf', TerraformTemplates.provider('aws'))
    await repo.writeFile('variables.tf', TerraformTemplates.variable('region'))
    await repo.writeFile('README.md', '# Not a tf file')

    const files = await adapter.findFiles('*.tf')

    expect(files).toHaveLength(2)
    expect(files).toContain('main.tf')
    expect(files).toContain('variables.tf')
    expect(files).not.toContain('README.md')
  })

  it('should search for text in file contents', async () => {
    await repo.writeFile(
      'main.tf',
      TerraformTemplates.module('../modules/database', 'db')
    )
    await repo.writeFile(
      'vpc.tf',
      TerraformTemplates.resource('aws_vpc', 'main')
    )
    await repo.writeFile('outputs.tf', TerraformTemplates.output('db_endpoint'))

    const files = await adapter.searchFileContents('database')

    expect(files).toContain('main.tf')
    expect(files).not.toContain('vpc.tf')
  })

  it('should read file contents', async () => {
    const content = TerraformTemplates.provider('aws')
    await repo.writeFile('provider.tf', content)

    const result = await adapter.readFile('provider.tf')

    expect(result).toBe(content)
  })

  it('should find files with specific pattern including nested paths', async () => {
    await repo.writeFile(
      'main.tf',
      TerraformTemplates.resource('aws_instance', 'app')
    )
    await repo.writeFile('provider.tf', TerraformTemplates.provider('aws'))
    await repo.writeFile(
      'modules/vpc/provider.tf',
      TerraformTemplates.provider('aws')
    )
    await repo.writeFile('outputs.tf', TerraformTemplates.output('instance_id'))

    const files = await adapter.findFiles('provider.tf')

    expect(files).toHaveLength(2)
    expect(files).toContain('provider.tf')
    expect(files).toContain('modules/vpc/provider.tf')
    expect(files).not.toContain('main.tf')
  })
})
