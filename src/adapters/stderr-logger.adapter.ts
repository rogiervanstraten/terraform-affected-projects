import { EOL } from 'node:os'
import type { LoggerPort } from '../ports/logger.port.js'

export class StderrLoggerAdapter implements LoggerPort {
  constructor(private readonly verbose: boolean = false) {}

  debug(message: string): void {
    if (this.verbose) {
      process.stderr.write(`debug: ${message}${EOL}`)
    }
  }

  info(message: string): void {
    if (this.verbose) {
      process.stderr.write(`${message}${EOL}`)
    }
  }

  warning(message: string): void {
    process.stderr.write(`warning: ${message}${EOL}`)
  }
}
