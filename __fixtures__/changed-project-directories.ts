import { jest } from '@jest/globals'

export const getChangedProjectPaths =
  jest.fn<
    typeof import('../src/changed-project-directories').getChangedProjectPaths
  >()
