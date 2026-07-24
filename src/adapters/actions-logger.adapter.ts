import * as core from '@actions/core'
import type { LoggerPort } from '../ports/logger.port.js'

export class ActionsLoggerAdapter implements LoggerPort {
  debug(message: string): void {
    core.debug(message)
  }

  info(message: string): void {
    core.info(message)
  }

  warning(message: string): void {
    core.warning(message)
  }
}
