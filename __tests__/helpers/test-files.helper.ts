/**
 * Common Terraform file templates for testing
 */
export const TerraformTemplates = {
  provider: (name: string = 'aws') => `provider "${name}" {}`,

  module: (source: string, name: string = 'app') =>
    `module "${name}" {\n  source = "${source}"\n}`,

  resource: (type: string, name: string) => `resource "${type}" "${name}" {}`,

  output: (name: string, value: string = 'value') =>
    `output "${name}" {\n  value = ${value}\n}`,

  variable: (name: string, type: string = 'string') =>
    `variable "${name}" {\n  type = ${type}\n}`,

  data: (type: string, name: string) => `data "${type}" "${name}" {}`,

  locals: (content: string) => `locals {\n  ${content}\n}`
}

/**
 * Pre-built Terraform project structures
 */
export const TerraformProjects = {
  /**
   * Simple service with module reference
   */
  simpleService: (serviceName: string, moduleSource: string) => ({
    [`${serviceName}/main.tf`]: TerraformTemplates.module(moduleSource),
    [`${serviceName}/provider.tf`]: TerraformTemplates.provider()
  }),

  /**
   * Multi-environment service
   */
  multiEnvService: (
    serviceName: string,
    environments: string[] = ['dev', 'staging', 'prod']
  ) => {
    const files: Record<string, string> = {}

    // Module directory
    files[`${serviceName}/module/main.tf`] = TerraformTemplates.resource(
      'aws_instance',
      'app'
    )
    files[`${serviceName}/module/provider.tf`] = TerraformTemplates.provider()

    // Environment directories
    for (const env of environments) {
      files[`${serviceName}/${env}/main.tf`] =
        TerraformTemplates.module('../module')
      files[`${serviceName}/${env}/provider.tf`] = TerraformTemplates.provider()
    }

    return files
  },

  /**
   * Shared module
   */
  sharedModule: (moduleName: string, resourceType: string) => ({
    [`modules/${moduleName}/main.tf`]: TerraformTemplates.resource(
      resourceType,
      'main'
    ),
    [`modules/${moduleName}/outputs.tf`]: TerraformTemplates.output('id'),
    [`modules/${moduleName}/variables.tf`]: TerraformTemplates.variable('name')
  }),

  /**
   * Complete monorepo structure
   */
  monorepo: () => {
    const files: Record<string, string> = {}

    // Shared modules
    Object.assign(
      files,
      TerraformProjects.sharedModule('vpc', 'aws_vpc'),
      TerraformProjects.sharedModule('database', 'aws_db_instance')
    )

    // Service A (uses database module)
    files['service-a/module/main.tf'] = TerraformTemplates.module(
      '../../modules/database'
    )
    files['service-a/module/provider.tf'] = TerraformTemplates.provider()
    files['service-a/production/main.tf'] =
      TerraformTemplates.module('../module')
    files['service-a/production/provider.tf'] = TerraformTemplates.provider()

    // Service B (no shared modules)
    files['service-b/module/main.tf'] = TerraformTemplates.resource(
      'aws_s3_bucket',
      'data'
    )
    files['service-b/module/provider.tf'] = TerraformTemplates.provider()
    files['service-b/production/main.tf'] =
      TerraformTemplates.module('../module')
    files['service-b/production/provider.tf'] = TerraformTemplates.provider()

    return files
  }
}
