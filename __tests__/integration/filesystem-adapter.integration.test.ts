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

  it('should read file contents', async () => {
    const content = TerraformTemplates.provider('aws')
    await repo.writeFile('provider.tf', content)

    const result = await adapter.readFile('provider.tf')

    expect(result).toBe(content)
  })

  it('should find Terraform files in nested directories with a basename glob', async () => {
    // Regression: findFiles('*.tf') previously missed nested .tf files because
    // minimatch '*' does not cross '/'. This caused dependency resolution to
    // silently return 0 affected projects when all .tf changes were nested.
    await repo.writeFile('main.tf', TerraformTemplates.provider('aws'))
    await repo.writeFile(
      'modules/vpc/main.tf',
      TerraformTemplates.resource('aws_vpc', 'main')
    )
    await repo.writeFile(
      'services/api/prod/main.tf',
      TerraformTemplates.resource('aws_instance', 'api')
    )
    await repo.writeFile('services/api/prod/README.md', '# docs')

    const files = await adapter.findFiles('*.tf')

    expect(files).toHaveLength(3)
    expect(files).toContain('main.tf')
    expect(files).toContain('modules/vpc/main.tf')
    expect(files).toContain('services/api/prod/main.tf')
    expect(files).not.toContain('services/api/prod/README.md')
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
