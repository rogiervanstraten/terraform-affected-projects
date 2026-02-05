import { describe, it, expect, beforeEach } from 'vitest'
import { MockFilesystemAdapter } from '../src/adapters/__mocks__/filesystem-mock.adapter.js'
import { TerraformProjectResolverService } from '../src/services/terraform-project-resolver.service.js'

describe('TerraformProjectResolverService - Nested Modules', () => {
  describe('with nested module structure (modules/rds/postgres/modules/database)', () => {
    /**
     * Test case for the scenario:
     * modules/rds/postgres/       <- parent module (referenced by projects)
     *   main.tf                     (references ./modules/database)
     *   modules/database/         <- nested module
     *     main.tf                   <- when this changes, should detect projects using parent
     *
     * services/api/production/
     *   main.tf                     (references modules/rds/postgres)
     */

    let filesystem: MockFilesystemAdapter
    let resolver: TerraformProjectResolverService

    beforeEach(() => {
      filesystem = new MockFilesystemAdapter({
        'modules/rds/postgres/main.tf':
          'module "database" { source = "./modules/database" }\nresource "aws_db_subnet_group" "main" {}',
        'modules/rds/postgres/variables.tf': 'variable "engine" {}',
        'modules/rds/postgres/modules/database/main.tf':
          'resource "aws_db_instance" "main" {}',
        'modules/rds/postgres/modules/database/outputs.tf':
          'output "endpoint" { value = aws_db_instance.main.endpoint }',
        'services/api/production/main.tf':
          'module "rds" { source = "../../../modules/rds/postgres" }',
        'services/api/production/provider.tf': 'provider "aws" {}',
        'services/web/production/main.tf':
          'resource "aws_s3_bucket" "assets" {}',
        'services/web/production/provider.tf': 'provider "aws" {}'
      })
      resolver = new TerraformProjectResolverService(filesystem)
    })

    it('should detect projects using parent module when nested module changes', async () => {
      // Act: A nested module file changes
      const taintedFiles = ['modules/rds/postgres/modules/database/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // Assert: Should detect services/api/production which references modules/rds/postgres
      expect(result).toContain('services/api/production')
      // Should NOT include services/web/production which doesn't use the module
      expect(result).not.toContain('services/web/production')
    })

    it('should detect projects when parent module changes', async () => {
      // Act: Parent module file changes
      const taintedFiles = ['modules/rds/postgres/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // Assert: Should detect services/api/production
      expect(result).toContain('services/api/production')
    })

    it('should detect projects when nested module outputs change', async () => {
      // Act: Nested module outputs file changes
      const taintedFiles = ['modules/rds/postgres/modules/database/outputs.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // Assert: Should detect services/api/production
      expect(result).toContain('services/api/production')
    })
  })

  describe('with deeply nested modules (multiple levels)', () => {
    /**
     * modules/networking/vpc/
     *   modules/subnets/
     *     modules/route-tables/
     *       main.tf
     *
     * services/platform/production/
     *   main.tf (references modules/networking/vpc)
     */

    let filesystem: MockFilesystemAdapter
    let resolver: TerraformProjectResolverService

    beforeEach(() => {
      filesystem = new MockFilesystemAdapter({
        'modules/networking/vpc/main.tf':
          'module "subnets" { source = "./modules/subnets" }',
        'modules/networking/vpc/modules/subnets/main.tf':
          'module "routes" { source = "./modules/route-tables" }',
        'modules/networking/vpc/modules/subnets/modules/route-tables/main.tf':
          'resource "aws_route_table" "main" {}',
        'services/platform/production/main.tf':
          'module "vpc" { source = "../../../modules/networking/vpc" }',
        'services/platform/production/provider.tf': 'provider "aws" {}'
      })
      resolver = new TerraformProjectResolverService(filesystem)
    })

    it('should detect projects using top-level module when deeply nested module changes', async () => {
      // Act: Deeply nested module changes
      const taintedFiles = [
        'modules/networking/vpc/modules/subnets/modules/route-tables/main.tf'
      ]
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // Assert: Should detect services/platform/production
      expect(result).toContain('services/platform/production')
    })
  })
})
