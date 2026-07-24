# Terraform Affected Projects

GitHub Action to detect affected Terraform projects in monorepos by analyzing
module dependencies and changed files.

## Features

- **Path-aware dependency resolution** - Correctly resolves Terraform module
  references across complex directory structures
- **Multiple monorepo patterns** - Supports various organizational patterns
  (shared modules, multi-environment, multi-domain, multi-account)
- **Git-based or manual file input** - Auto-detect changes via Git diff or
  provide files manually
- **Full project discovery mode** - Return all Terraform project roots on demand
- **Glob pattern filtering** - Include/exclude files using glob patterns
- **Security-hardened** - No shell injection vulnerabilities, input sanitization

## How Projects Are Identified

> **This is the most important concept to understand before using this action.**

A directory is treated as a **Terraform project root** when it contains the file
specified by `project-marker` (default: `provider.tf`). This file is what the
action uses to discover all deployable projects in your repository —
particularly when using `resolve-root: true`.

If your monorepo uses a different convention, set `project-marker` accordingly:

| Convention                                   | `project-marker` value |
| -------------------------------------------- | ---------------------- |
| Provider declared in `provider.tf` (default) | `provider.tf`          |
| Provider + versions in `versions.tf`         | `versions.tf`          |
| Everything in one file                       | `main.tf`              |
| Backend config as the marker                 | `backend.tf`           |

**Example:** if your projects look like this:

```
services/api/prod/
  backend.tf    ← marker file
  main.tf
  variables.tf
```

Set `project-marker: backend.tf` so the action knows `services/api/prod/` is a
project root.

Changed directories that are not module paths are resolved to the nearest
ancestor directory containing the marker file. A changed directory with no
marker in itself or any ancestor is not a project and produces no output.

## Usage

```yaml
- name: Detect affected Terraform projects
  uses: rogiervanstraten/terraform-affected-projects@v1
  with:
    # IMPORTANT: The file that marks a directory as a Terraform project root.
    # Defaults to 'provider.tf'. Change if your projects use a different
    # convention (e.g. 'versions.tf', 'main.tf', 'backend.tf').
    project-marker: provider.tf

    # Optional: Provide changed files manually (if not provided, auto-detected via git)
    changed-files: |
      modules/vpc/main.tf
      services/api/production/main.tf

    # Optional: Git references for diff (auto-detected for pull_request and
    # push events). Both must be set together; providing only one falls back
    # to diffing the current commit.
    base-ref: 'main'
    head-ref: 'HEAD'

    # Optional: Include only files matching these glob patterns.
    # Defaults to '**/*.tf', '**/*.tfvars' and '**/*.hcl'.
    files: |
      **/*.tf
      **/*.tfvars
      **/*.hcl

    # Optional: Exclude file patterns
    files-ignore: |
      **/*.md
      .github/**

    # Optional: Return all projects if root directory changes
    resolve-root: false

    # Optional: Return all projects regardless of changed files.
    # Takes precedence over `resolve-root` when enabled.
    all-projects: false

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
  run: echo "Affected projects: ${{ steps.affected.outputs.changed-directories }}"
```

## CLI Usage

The same detection logic is available as a standalone CLI, useful for local
debugging or non-GitHub pipelines. Build it with `npm run package`, then run
`dist/cli.js` from your Terraform repository (or point it there with `--cwd`):

```sh
node /path/to/terraform-affected-projects/dist/cli.js --base origin/main --head HEAD
```

Or install it globally to get the `tfaf` command (also available under its full
name `terraform-affected-projects`):

```sh
npm install --global /path/to/terraform-affected-projects
tfaf --base origin/main --head HEAD
```

Affected project directories are printed to stdout, one per line (or as a JSON
array with `--json`). All logging goes to stderr, so stdout is safe to pipe.

Without `--base`, `--changed-file` or `--all-projects`, uncommitted changes
(staged, unstaged and untracked) are used as the change set; a clean working
tree yields no projects.

```text
Options:
  -b, --base <ref>            Base git reference for the diff
  -H, --head <ref>            Head git reference for the diff (default: HEAD)
      --changed-file <path>   Changed file to use instead of git detection
                              (repeatable)
      --files <glob>          Include only files matching this glob
                              (repeatable, default: **/*.tf, **/*.tfvars, **/*.hcl)
      --files-ignore <glob>   Exclude files matching this glob (repeatable)
      --resolve-root          Resolve all projects when root files change
  -a, --all-projects          Return all projects regardless of changes
      --project-marker <file> Filename marking a project root
                              (default: provider.tf)
      --ignore-path <path>    Path to ignore (repeatable, default: ., .git, node_modules)
  -C, --cwd <dir>             Run as if started in <dir>
      --json                  Print a JSON array instead of one path per line
  -v, --verbose               Print debug logs to stderr
  -h, --help                  Show this help
```

## Why This Action?

In Terraform monorepos, a change to a shared module can affect multiple
projects. Without dependency tracking, you'd either:

- **Re-run everything** (slow, wasteful CI/CD)
- **Manual tracking** (error-prone, hard to maintain)
- **Miss dependencies** (deploy broken infrastructure)

This action solves this by automatically detecting which Terraform projects are
affected by your changes through module dependency analysis.

### Example Scenarios

**Scenario 1: Shared Module Change**

```
modules/database/
  main.tf          # ← Changed
service-a/production/
  main.tf          # References modules/database
service-b/production/
  main.tf          # No dependency
```

**Result**: Only `service-a/production` is affected and needs to run
`terraform plan/apply`

**Scenario 2: Multi-Environment Projects**

```
services/api-gateway/
  module/
    main.tf        # ← Changed
  dev/
    main.tf        # References ../module
  staging/
    main.tf        # References ../module
  prod/
    main.tf        # References ../module
```

**Result**: All environments (`dev`, `staging`, `prod`) are affected

This also works when the change is inside a **subdirectory** of the project
module (e.g. `services/api-gateway/module/account/main.tf`): the change is
attributed to any project referencing `../module` or the subdirectory itself.

**Scenario 3: Nested Dependencies**

```
modules/vpc/
  main.tf          # ← Changed
modules/eks-cluster/
  main.tf          # References ../vpc
services/platform/prod/
  main.tf          # References ../../modules/eks-cluster
```

**Result**: `services/platform/prod` is affected (transitive dependency
resolution)

## Supported Monorepo Patterns

Works with various Terraform monorepo structures:

- **Shared modules**: `modules/`, `_modules/` or `shared-modules/` with project
  references, including nested module trees (`modules/compute_engine/sftpgo/`)
- **Multi-environment**: `service-X/{dev,staging,prod}`
- **Multi-domain**: Nested organizational structures (`domain-A/subdomain-I/`)
- **Multi-account**: Flat account-based layouts (`account-production/`,
  `account-staging/`)
- **Project modules**: Service-specific `*/module` directories with environment
  deployments, including service-named subdirectories
  (`platform/core/module/catalog/`)

A directory is treated as a module when any of its path segments ends in
`module` or `modules`.

## Development

```bash
npm install
npm run all    # Format, lint, test, and build
npm test       # Run tests with Vitest
```

## License

MIT
