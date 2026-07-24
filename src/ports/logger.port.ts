export interface LoggerPort {
  debug(message: string): void
  info(message: string): void
  warning(message: string): void
}

export const noopLogger: LoggerPort = {
  debug: () => {},
  info: () => {},
  warning: () => {}
}
