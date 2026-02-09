import * as core from '@actions/core'

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

export class DependencyResolverTelemetry {
  private steps: ResolutionStep[] = []
  private startTime: number
  private currentStep = 0

  constructor() {
    this.startTime = Date.now()
  }

  recordDiscovered(paths: string | string[]): void {
    this.recordStep('discovered', paths)
  }

  recordModuleDependency(paths: string | string[]): void {
    this.recordStep('module_dependency', paths)
  }

  recordProjectDependency(paths: string | string[]): void {
    this.recordStep('project_dependency', paths)
  }

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

  getTrace(): ResolutionStep[] {
    return [...this.steps]
  }

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
