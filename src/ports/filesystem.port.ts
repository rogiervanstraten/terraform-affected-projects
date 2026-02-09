export interface FilesystemPort {
  findFiles(pattern: string, excludePaths?: string[]): Promise<string[]>

  searchFileContents(
    searchText: string,
    filePattern?: string,
    wordMatch?: boolean
  ): Promise<string[]>

  readFile(filePath: string): Promise<string>
}
