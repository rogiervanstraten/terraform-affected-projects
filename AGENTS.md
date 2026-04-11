# Agent Guidelines

## Code Style Rules

- **Never add comments to code**: Code should be self-documenting through clear
  variable names, function names, and structure. Do not add inline comments,
  block comments, or documentation comments to the codebase.

## Commit Message Guidelines

- **Always use conventional commits**: All commit messages must follow the
  [Conventional Commits](https://www.conventionalcommits.org/) specification.
  Use the format `<type>(<scope>): <description>` where:
  - `type` is one of: `feat`, `fix`, `docs`, `style`, `refactor`, `test`,
    `chore`, `ci`, `perf`, `build`
  - `scope` is optional and indicates the area of change
  - `description` is a brief summary in present tense
  - Example: `feat(git): add support for detecting renamed files`
