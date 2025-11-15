# Terraform Affected Projects

GitHub Action to detect affected Terraform projects in monorepos by analyzing module dependencies and changed files.

## Features

- **Path-aware dependency resolution** - Correctly resolves Terraform module references across complex directory structures
- **Multiple monorepo patterns** - Supports various organizational patterns (shared modules, multi-environment, multi-domain, multi-account)
- **Git-based or manual file input** - Auto-detect changes via git diff or provide files manually
- **Glob pattern filtering** - Include/exclude files using glob patterns
- **Security-hardened** - No shell injection vulnerabilities, input sanitization

## Usage

```yaml
- name: Detect affected Terraform projects
  uses: rogiervanstraten/terraform-affected-projects@v1
  with:
    # Optional: Provide changed files manually (if not provided, auto-detected via git)
    changed-files: |
      modules/vpc/main.tf
      services/api/production/main.tf

    # Optional: Git references for diff (defaults to HEAD^ and HEAD)
    base-ref: 'main'
    head-ref: 'HEAD'

    # Optional: Include only specific file patterns
    files: |
      **.tf
      **.tfvars

    # Optional: Exclude file patterns
    files-ignore: |
      **/*.md
      .github/**

    # Optional: Return all projects if root directory changes
    resolve-root: false

    # Optional: Paths to ignore
    ignore-paths: |
      .
      .git
      node_modules
```

## Outputs

- `changed-directories` - JSON array of affected Terraform project directories

### Example

```yaml
- name: Detect affected projects
  id: affected
  uses: rogiervanstraten/terraform-affected-projects@v1

- name: Show affected projects
  run: |
    echo "Affected projects: ${{ steps.affected.outputs.changed-directories }}"
```

## Supported Monorepo Patterns

Works with various Terraform monorepo structures:

- **Shared modules**: `modules/` or `_modules/` with project references
- **Multi-environment**: `service-X/{dev,staging,prod}`
- **Multi-domain**: Nested organizational structures
- **Multi-account**: Flat account-based layouts
- **Project modules**: Service-specific `*/module` directories

## Development

```bash
npm install
npm run all    # Format, lint, test, and build
npm test       # Run tests with Vitest
```

## License

MIT
