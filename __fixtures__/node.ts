import { jest } from '@jest/globals'
import { execSync as _execSync } from 'node:child_process'

// Mock the child_process module
// jest.mock('node:child_process')

export const execSync = jest.fn<typeof _execSync>()
