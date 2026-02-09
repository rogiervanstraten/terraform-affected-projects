export interface FileFilterPort {
  filter(
    files: string[],
    includePatterns: string[],
    excludePatterns: string[]
  ): string[]
}
