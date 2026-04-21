import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FilesystemAdapter } from '../../src/adapters/filesystem.adapter.js'
import { TerraformProjectResolverService } from '../../src/services/terraform-project-resolver.service.js'
import { TestRepoHelper } from '../helpers/test-repo.helper.js'

/**
 * Integration test for the resolver against the real FilesystemAdapter.
 *
 * Unit tests use a MockFilesystemAdapter that historically set
 * `matchBase: true` on minimatch, while the real adapter did not. That
 * divergence hid a bug where `findFiles('*.tf')` returned no nested files,
 * causing `resolveAffectedProjects` to return [] for any change whose only
 * changed directories were shared modules or project-modules.
 */
describe('TerraformProjectResolverService - Integration Test', () => {
  let repo: TestRepoHelper
  let resolver: TerraformProjectResolverService

  beforeEach(async () => {
    repo = new TestRepoHelper()
    const repoPath = await repo.create()
    resolver = new TerraformProjectResolverService(
      new FilesystemAdapter(repoPath)
    )
  })

  afterEach(async () => {
    await repo.cleanup()
  })

  it('resolves transitive dependency: shared module → project-module → envs', async () => {
    await repo.writeFiles({
      'modules/cloud-run/main.tf':
        'resource "google_cloud_run_service" "svc" {}',
      'modules/cloud-run/variables.tf': 'variable "name" {}',
      'core-services/authentication/module/cloud-run.tf':
        'module "run" { source = "../../../modules/cloud-run" }',
      'core-services/authentication/module/variables.tf': 'variable "env" {}',
      'core-services/authentication/production/provider.tf':
        'provider "google" {}',
      'core-services/authentication/production/main.tf':
        'module "auth" { source = "../module" }',
      'core-services/authentication/staging/provider.tf':
        'provider "google" {}',
      'core-services/authentication/staging/main.tf':
        'module "auth" { source = "../module" }'
    })

    const result = await resolver.resolveAffectedProjects([
      'modules/cloud-run/main.tf',
      'modules/cloud-run/variables.tf',
      'core-services/authentication/module/cloud-run.tf'
    ])

    expect(result.sort()).toEqual([
      'core-services/authentication/production',
      'core-services/authentication/staging'
    ])
  })

  it('resolves a shared-module change when only nested .tf files exist', async () => {
    // Covers the minimatch basename-glob bug directly: all .tf files are
    // nested, so a buggy findFiles('*.tf') would return [] and the resolver
    // would find no referencing files.
    await repo.writeFiles({
      'modules/vpc/main.tf': 'resource "aws_vpc" "main" {}',
      'services/api/prod/provider.tf': 'provider "aws" {}',
      'services/api/prod/main.tf':
        'module "net" { source = "../../../modules/vpc" }'
    })

    const result = await resolver.resolveAffectedProjects([
      'modules/vpc/main.tf'
    ])

    expect(result).toEqual(['services/api/prod'])
  })
})
