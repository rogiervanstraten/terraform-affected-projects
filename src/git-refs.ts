import * as core from '@actions/core'

export interface GitRefs {
  base: string
  head: string
}

const ZERO_SHA = '0000000000000000000000000000000000000000'

/**
 * Derive base/head refs from user inputs, falling back to the GitHub event
 * payload (pull_request or push) when neither input is provided.
 * Returns empty strings if nothing can be determined.
 */
export async function resolveGitRefs(inputs: GitRefs): Promise<GitRefs> {
  if (inputs.base || inputs.head) return inputs

  switch (process.env.GITHUB_EVENT_NAME) {
    case 'pull_request':
      return resolvePullRequestRefs(process.env.GITHUB_EVENT_PATH)
    case 'push':
      return resolvePushRefs(process.env.GITHUB_EVENT_PATH)
    default:
      return { base: '', head: '' }
  }
}

async function resolvePullRequestRefs(eventPath?: string): Promise<GitRefs> {
  try {
    if (!eventPath) throw new Error('No GITHUB_EVENT_PATH')

    const { readFileSync } = await import('node:fs')
    const eventData = JSON.parse(readFileSync(eventPath, 'utf8'))

    if (!eventData.pull_request) {
      throw new Error('No pull_request data in event')
    }

    const base = eventData.pull_request.base.sha
    const head = eventData.pull_request.head.sha || 'HEAD'
    core.info(`Using PR SHAs - base: ${base}, head: ${head}`)
    return { base, head }
  } catch (error) {
    core.debug(`Failed to parse PR event data: ${error}`)
    core.info('Falling back to environment variables')

    const baseBranch = process.env.GITHUB_BASE_REF || 'main'
    const base = `remotes/origin/${baseBranch}`
    const head = 'HEAD'
    core.info(`Using branch refs - base: ${base}, head: ${head}`)
    return { base, head }
  }
}

async function resolvePushRefs(eventPath?: string): Promise<GitRefs> {
  const empty: GitRefs = { base: '', head: '' }

  try {
    if (!eventPath) return empty

    const { readFileSync } = await import('node:fs')
    const { before, after } = JSON.parse(readFileSync(eventPath, 'utf8'))

    if (!after || !before || before === ZERO_SHA) return empty

    core.info(`Using push SHAs - base: ${before}, head: ${after}`)
    return { base: before, head: after }
  } catch (error) {
    core.debug(`Failed to parse push event data: ${error}`)
    return empty
  }
}
