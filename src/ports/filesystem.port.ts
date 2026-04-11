export interface FilesystemPort {
  findFiles(pattern: string, excludePaths?: string[]): Promise<string[]>
  readFile(filePath: string): Promise<string>
}
