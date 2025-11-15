import { describe, it, expect, beforeEach } from 'vitest'
import { MockFilesystemAdapter } from '../src/adapters/__mocks__/filesystem-mock.adapter.js'
import { TerraformProjectResolverService } from '../src/services/terraform-project-resolver.service.js'
import { TerraformProjectFactory } from './fixtures/terraform-project-factory.js'

describe('TerraformProjectResolverService', () => {
  describe('with simple project structure', () => {
    /**
     * Project structure:
     * service-a/
     *   module/          (contains reference to modules/database)
     *     provider.tf
     *     main.tf
     *   production/      (contains reference to ../module)
     *     provider.tf
     *     main.tf
     * service-b/
     *   module/
     *     provider.tf
     *     main.tf
     *   production/      (contains reference to ../module)
     *     provider.tf
     *     main.tf
     * modules/           (shared modules directory)
     *   database/
     *     main.tf
     *     outputs.tf
     */

    let filesystem: MockFilesystemAdapter
    let resolver: TerraformProjectResolverService

    beforeEach(() => {
      filesystem = new MockFilesystemAdapter(
        TerraformProjectFactory.createSimpleProject()
      )
      resolver = new TerraformProjectResolverService(filesystem)
    })

    it('should detect service-a/production when service-a/module file changes', async () => {
      // Act: A file in service-a/module changed
      const taintedFiles = ['service-a/module/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // Assert: service-a/production should be affected
      // Because service-a/production/main.tf contains "source = ../module"
      expect(result).toContain('service-a/production')
    })

    it('should detect service-a when shared modules/database changes', async () => {
      // Act: Shared database module changed
      const taintedFiles = ['modules/database/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // Assert: service-a should be affected (it uses modules/database)
      // The chain is: modules/database → service-a/module → service-a/production
      expect(result).toContain('service-a/production')
      expect(result).not.toContain('service-b/production')
    })

    it('should detect only the specific service when project file changes directly', async () => {
      // Act: Direct change in service-b/production
      const taintedFiles = ['service-b/production/main.tf']
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // Assert: Only service-b/production affected
      expect(result).toEqual(['service-b/production'])
    })

    it('should handle multiple changed files', async () => {
      // Act: Changes in both services
      const taintedFiles = [
        'service-a/production/main.tf',
        'service-b/production/main.tf'
      ]
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // Assert: Both projects affected
      expect(result).toHaveLength(2)
      expect(result).toContain('service-a/production')
      expect(result).toContain('service-b/production')
    })

    it('should return unique projects when multiple files in same project change', async () => {
      // Act: Multiple files in same project
      const taintedFiles = [
        'service-a/production/main.tf',
        'service-a/production/provider.tf'
      ]
      const result = await resolver.resolveAffectedProjects(taintedFiles)

      // Assert: Only one instance of service-a/production
      expect(result).toEqual(['service-a/production'])
    })

    it('should handle ignored paths correctly', async () => {
      // Act: Change in ignored path
      const taintedFiles = ['README.md']
      const result = await resolver.resolveAffectedProjects(taintedFiles, {
        ignoredPaths: ['.']
      })

      // Assert: No projects affected
      expect(result).toEqual([])
    })
  })
})
