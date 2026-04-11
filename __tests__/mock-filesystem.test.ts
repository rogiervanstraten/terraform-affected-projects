import { describe, it, expect } from 'vitest'
import { MockFilesystemAdapter } from '../src/adapters/__mocks__/filesystem-mock.adapter.js'
import { TerraformProjectFactory } from './fixtures/terraform-project-factory.js'

describe('MockFilesystemAdapter', () => {
  it('should create the simple project structure correctly', () => {
    const filesystem = TerraformProjectFactory.createSimpleProject()

    expect(filesystem['service-a/module/provider.tf']).toBeDefined()
    expect(filesystem['service-a/module/main.tf']).toContain('modules/database')
    expect(filesystem['service-a/production/main.tf']).toContain('../module')
    expect(filesystem['modules/database/main.tf']).toBeDefined()
  })

  it('should find files matching a pattern', async () => {
    const fs = new MockFilesystemAdapter(
      TerraformProjectFactory.createSimpleProject()
    )

    const providerFiles = await fs.findFiles('provider.tf')
    expect(providerFiles.length).toBeGreaterThan(0)
    expect(providerFiles).toContain('service-a/module/provider.tf')
  })
})
