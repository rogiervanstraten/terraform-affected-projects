import { describe, it, expect, beforeEach } from 'vitest'
import { MockFilesystemAdapter } from '../src/adapters/__mocks__/filesystem-mock.adapter.js'
import { TerraformProjectResolverService } from '../src/services/terraform-project-resolver.service.js'
import { TerraformProjectFactory } from './fixtures/terraform-project-factory.js'

describe('TerraformProjectResolverService - Different Monorepo Patterns', () => {
  describe('Multi-domain GCP organization pattern', () => {
    /**
     * Structure: _modules/ for shared, domain-X/ for projects, nested subdomains
     * Tests underscore-prefixed modules and nested domain structures
     */
    let filesystem: MockFilesystemAdapter
    let resolver: TerraformProjectResolverService

    beforeEach(() => {
      filesystem = new MockFilesystemAdapter(
        TerraformProjectFactory.createMultiDomainProject()
      )
      resolver = new TerraformProjectResolverService(filesystem)
    })

    it('should detect all domains when shared _modules/project changes', async () => {
      const taintedFiles = ['_modules/project/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // All domains use _modules/project, but infrastructure uses multi-env-projects
      expect(result).toContain('domain-A')
      expect(result).toContain('domain-B')
      expect(result).toContain('domain-B/subdomain-I')
      expect(result).toContain('domain-B/subdomain-II')
      expect(result).not.toContain('infrastructure')
    })

    it('should detect only parent domain when subdomain changes', async () => {
      const taintedFiles = ['domain-B/subdomain-I/project1.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('domain-B/subdomain-I')
      expect(result).not.toContain('domain-B/subdomain-II')
      expect(result).not.toContain('domain-A')
    })

    it('should detect infrastructure as standalone project', async () => {
      const taintedFiles = ['infrastructure/terraform-states.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('infrastructure')
      expect(result).toHaveLength(1)
    })
  })

  describe('Multi-environment microservices pattern', () => {
    /**
     * Structure: modules/ shared, services/X/module + services/X/{dev,staging,prod}
     * Tests nested environment directories and transitive module dependencies
     */
    let filesystem: MockFilesystemAdapter
    let resolver: TerraformProjectResolverService

    beforeEach(() => {
      filesystem = new MockFilesystemAdapter(
        TerraformProjectFactory.createMicroservicesProject()
      )
      resolver = new TerraformProjectResolverService(filesystem)
    })

    it('should detect all services using VPC when modules/vpc changes', async () => {
      const taintedFiles = ['modules/vpc/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // VPC is used by api-gateway, user-service, and platform (via eks)
      // Each service has multiple environments
      expect(result).toContain('services/api-gateway/dev')
      expect(result).toContain('services/api-gateway/staging')
      expect(result).toContain('services/api-gateway/prod')
      expect(result).toContain('services/user-service/dev')
      expect(result).toContain('services/user-service/prod')
      expect(result).toContain('services/platform/dev')
      expect(result).toContain('services/platform/prod')
    })

    it('should detect transitive dependencies when eks-cluster changes', async () => {
      const taintedFiles = ['modules/eks-cluster/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // Only platform service uses eks-cluster
      expect(result).toContain('services/platform/dev')
      expect(result).toContain('services/platform/prod')
      expect(result).not.toContain('services/api-gateway/dev')
      expect(result).not.toContain('services/user-service/dev')
    })

    it('should detect all envs when service module changes', async () => {
      const taintedFiles = ['services/api-gateway/module/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('services/api-gateway/dev')
      expect(result).toContain('services/api-gateway/staging')
      expect(result).toContain('services/api-gateway/prod')
      expect(result).toHaveLength(3)
    })

    it('should detect only specific env when env file changes', async () => {
      const taintedFiles = ['services/user-service/prod/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('services/user-service/prod')
      expect(result).not.toContain('services/user-service/dev')
      expect(result).toHaveLength(1)
    })

    it('should detect global as standalone project', async () => {
      const taintedFiles = ['global/iam.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('global')
      expect(result).toHaveLength(1)
    })
  })

  describe('E-commerce platform pattern (project module subdirectories)', () => {
    /**
     * Structure: platform/core/module/{catalog,search} service subdirs,
     * checkout/module, nested shared modules/compute_engine/sftpgo,
     * direct projects under inventory/ and content/
     */
    let filesystem: MockFilesystemAdapter
    let resolver: TerraformProjectResolverService

    beforeEach(() => {
      filesystem = new MockFilesystemAdapter(
        TerraformProjectFactory.createEcommercePlatformProject()
      )
      resolver = new TerraformProjectResolverService(filesystem)
    })

    it('should detect all envs when a project module subdirectory changes', async () => {
      const taintedFiles = ['platform/core/module/catalog/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('platform/core/staging')
      expect(result).toContain('platform/core/production')
      expect(result).toHaveLength(2)
    })

    it('should detect a direct project when its own files change', async () => {
      const taintedFiles = ['inventory/warehouse/production/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toEqual(['inventory/warehouse/production'])
    })

    it('should return nothing for a directory that is not a project', async () => {
      const taintedFiles = ['inventory/warehouse/invalid-dir/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toEqual([])
    })

    it('should detect all envs when a flat project module changes', async () => {
      const taintedFiles = ['checkout/module/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('checkout/staging')
      expect(result).toContain('checkout/production')
      expect(result).toHaveLength(2)
    })

    it('should detect all envs when the project module root changes', async () => {
      const taintedFiles = ['platform/core/module/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('platform/core/staging')
      expect(result).toContain('platform/core/production')
      expect(result).toHaveLength(2)
    })

    it('should detect all dependents of a nested shared module', async () => {
      const taintedFiles = ['modules/compute_engine/sftpgo/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('content/newsletter-assets')
      expect(result).toContain('inventory/warehouse/production')
      expect(result).toHaveLength(2)
    })

    it('should resolve lock file changes to their project', async () => {
      const taintedFiles = [
        'inventory/warehouse/production/.terraform.lock.hcl'
      ]
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toEqual(['inventory/warehouse/production'])
    })

    it('should resolve nested non-project subdirectories to their project root', async () => {
      const taintedFiles = ['inventory/warehouse/production/configs/app.tfvars']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toEqual(['inventory/warehouse/production'])
    })
  })

  describe('Multi-account flat pattern', () => {
    /**
     * Structure: shared-modules/ and account-X/ at root
     * Tests flat directory structure with multiple accounts
     */
    let filesystem: MockFilesystemAdapter
    let resolver: TerraformProjectResolverService

    beforeEach(() => {
      filesystem = new MockFilesystemAdapter(
        TerraformProjectFactory.createMultiAccountProject()
      )
      resolver = new TerraformProjectResolverService(filesystem)
    })

    it('should detect all accounts when shared networking module changes', async () => {
      const taintedFiles = ['shared-modules/networking/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('account-production')
      expect(result).toContain('account-staging')
      expect(result).toContain('account-dev')
      expect(result).not.toContain('account-shared-services')
    })

    it('should detect accounts using security module', async () => {
      const taintedFiles = ['shared-modules/security/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // Only account-production uses security module
      expect(result).toContain('account-production')
      expect(result).not.toContain('account-staging')
      expect(result).not.toContain('account-dev')
    })

    it('should detect single account when account file changes', async () => {
      const taintedFiles = ['account-production/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('account-production')
      expect(result).toHaveLength(1)
    })

    it('should handle account with no module dependencies', async () => {
      const taintedFiles = ['account-shared-services/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('account-shared-services')
      expect(result).toHaveLength(1)
    })
  })

  describe('Git source modules pattern', () => {
    /**
     * Structure: modules/ referenced via git:: or github.com// shorthand URLs.
     * Consumers without a ref should be flagged when the local module path changes.
     * Consumers with ?ref=<version> are pinned and should NOT be flagged by a module
     * change — only a direct change to their own .tf file triggers detection.
     */
    let filesystem: MockFilesystemAdapter
    let resolver: TerraformProjectResolverService

    beforeEach(() => {
      filesystem = new MockFilesystemAdapter(
        TerraformProjectFactory.createGitSourceProject()
      )
      resolver = new TerraformProjectResolverService(filesystem)
    })

    it('should detect a project using a git:: source when the referenced module path changes', async () => {
      const taintedFiles = ['modules/vpc/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('projects/api-service')
    })

    it('should detect a project using a github.com// shorthand source when the module changes', async () => {
      const taintedFiles = ['modules/vpc/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('projects/api-service-v2')
    })

    it('should detect all unrefed consumers when a shared git-sourced module changes', async () => {
      const taintedFiles = ['modules/vpc/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('projects/api-service')
      expect(result).toContain('projects/api-service-v2')
      expect(result).toContain('projects/shared-infra')
    })

    it('should NOT flag a consumer pinned with ?ref= when only the module changes', async () => {
      const taintedFiles = ['modules/vpc/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).not.toContain('projects/legacy-api')
    })

    it('should flag a pinned consumer when its own .tf file changes', async () => {
      const taintedFiles = ['projects/legacy-api/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('projects/legacy-api')
    })

    it('should detect only projects referencing the changed module, not others', async () => {
      const taintedFiles = ['modules/rds/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('projects/db-service')
      expect(result).toContain('projects/shared-infra')
      expect(result).not.toContain('projects/api-service')
      expect(result).not.toContain('projects/api-service-v2')
    })

    it('should detect a project that mixes relative and git sources for the same module', async () => {
      const taintedFiles = ['modules/vpc/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      expect(result).toContain('mixed-approach/production')
    })
  })
})
