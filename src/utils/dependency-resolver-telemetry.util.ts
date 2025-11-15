import * as core from '@actions/core'

/**
 * Tracks the step-by-step resolution of dependencies
 * Used for debugging and understanding how the resolver traverses the dependency graph
 */
interface ResolutionStep {
  step: number
  action:
    | 'discovered'
    | 'module_dependency'
    | 'project_dependency'
    | 'direct_project'
  paths: string[]
  timestamp: number
}

/**
 * Dependency Resolver Telemetry
 *
 * Provides observability into the Terraform dependency resolution process.
 * Tracks:
 * - What directories were discovered
 * - How dependencies were resolved
 * - The traversal path through the dependency graph
 *
 * This is useful for:
 * - Debugging why certain projects are included
 * - Understanding the dependency chain
 * - Performance analysis
 */
export class DependencyResolverTelemetry {
  private steps: ResolutionStep[] = []
  private startTime: number
  private currentStep = 0

  constructor() {
    this.startTime = Date.now()
  }

  /**
   * Record initial discovered directories from changed files
   */
  recordDiscovered(paths: string | string[]): void {
    this.recordStep('discovered', paths)
  }

  /**
   * Record when a module dependency is found
   * (e.g., a change in modules/ directory triggers finding usages)
   */
  recordModuleDependency(paths: string | string[]): void {
    this.recordStep('module_dependency', paths)
  }

  /**
   * Record when a project dependency is found
   * (e.g., a change in /module directory resolves to parent projects)
   */
  recordProjectDependency(paths: string | string[]): void {
    this.recordStep('project_dependency', paths)
  }

  /**
   * Record a direct project change (no dependency lookup needed)
   */
  recordDirectProject(path: string): void {
    this.recordStep('direct_project', [path])
  }

  private recordStep(
    action: ResolutionStep['action'],
    paths: string | string[]
  ): void {
    const pathsArray = Array.isArray(paths) ? paths : [paths]

    if (pathsArray.length === 0) return

    this.currentStep++
    this.steps.push({
      step: this.currentStep,
      action,
      paths: pathsArray,
      timestamp: Date.now() - this.startTime
    })
  }

  /**
   * Get a summary of the resolution process
   */
  getSummary(): {
    totalSteps: number
    totalPaths: number
    durationMs: number
    byAction: Record<string, number>
  } {
    const byAction = this.steps.reduce(
      (acc, step) => {
        acc[step.action] = (acc[step.action] || 0) + step.paths.length
        return acc
      },
      {} as Record<string, number>
    )

    return {
      totalSteps: this.steps.length,
      totalPaths: this.steps.reduce((sum, step) => sum + step.paths.length, 0),
      durationMs: Date.now() - this.startTime,
      byAction
    }
  }

  /**
   * Get detailed trace of resolution steps
   */
  getTrace(): ResolutionStep[] {
    return [...this.steps]
  }

  /**
   * Output telemetry to GitHub Actions debug logs
   */
  outputToDebugLogs(): void {
    if (!this.steps.length) {
      core.debug('No dependency resolution steps recorded')
      return
    }

    core.startGroup('🔍 Dependency Resolution Trace')

    this.steps.forEach((step) => {
      const pathsStr =
        step.paths.length === 1 ? step.paths[0] : `[${step.paths.length} paths]`

      core.debug(
        `Step ${step.step} (+${step.timestamp}ms): ${step.action} → ${pathsStr}`
      )

      if (step.paths.length > 1) {
        step.paths.forEach((p) => core.debug(`  - ${p}`))
      }
    })

    const summary = this.getSummary()
    core.debug(`\n📊 Summary:`)
    core.debug(`  Total steps: ${summary.totalSteps}`)
    core.debug(`  Total paths processed: ${summary.totalPaths}`)
    core.debug(`  Duration: ${summary.durationMs}ms`)
    core.debug(`  By action:`)
    Object.entries(summary.byAction).forEach(([action, count]) => {
      core.debug(`    ${action}: ${count}`)
    })

    core.endGroup()
  }

  /**
   * Get a simplified dependency chain for a specific project
   * Shows how we determined a project was affected
   */
  getDependencyChain(targetPath: string): string[] {
    const chain: string[] = []

    for (const step of this.steps) {
      if (step.paths.includes(targetPath)) {
        chain.push(`${step.action}: ${targetPath}`)
        break
      }
    }

    return chain
  }
}
