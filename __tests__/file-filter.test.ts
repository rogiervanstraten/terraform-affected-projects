import { describe, it, expect } from 'vitest'
import { FileFilterAdapter } from '../src/adapters/file-filter.adapter.js'

describe('FileFilterAdapter', () => {
  const filter = new FileFilterAdapter()
  const defaultPatterns = ['**/*.tf', '**/*.tfvars', '**/*.hcl']

  it('should keep Terraform, tfvars and hcl files with the default patterns', () => {
    const files = [
      'platform/core/module/catalog/main.tf',
      'inventory/warehouse/production/terraform.tfvars',
      'inventory/warehouse/production/.terraform.lock.hcl',
      'checkout/terragrunt.hcl'
    ]

    const result = filter.filter(files, defaultPatterns, [])

    expect(result).toEqual(files)
  })

  it('should skip markdown files with the default patterns', () => {
    const files = [
      'README.md',
      'docs/setup.md',
      'platform/core/module/catalog/main.tf'
    ]

    const result = filter.filter(files, defaultPatterns, [])

    expect(result).toEqual(['platform/core/module/catalog/main.tf'])
  })

  it('should apply exclude patterns before include patterns', () => {
    const files = ['modules/vpc/main.tf', 'examples/demo/main.tf']

    const result = filter.filter(files, defaultPatterns, ['examples/**'])

    expect(result).toEqual(['modules/vpc/main.tf'])
  })

  it('should keep all files when no patterns are given', () => {
    const files = ['README.md', 'main.tf']

    expect(filter.filter(files, [], [])).toEqual(files)
  })
})
