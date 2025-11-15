import type { MockFilesystem } from '../../src/adapters/__mocks__/filesystem-mock.adapter.js'

/**
 * Tree structure representing a directory and its contents
 */
export type FileTree = {
  [key: string]: FileTree | string
}

/**
 * Factory for creating Terraform project structures from tree notation
 */
export class TerraformProjectFactory {
  /**
   * Converts a tree structure to a flat MockFilesystem
   */
  static fromTree(tree: FileTree, basePath: string = ''): MockFilesystem {
    const filesystem: MockFilesystem = {}

    for (const [key, value] of Object.entries(tree)) {
      const fullPath = basePath ? `${basePath}/${key}` : key

      if (typeof value === 'string') {
        // It's a file
        filesystem[fullPath] = value
      } else {
        // It's a directory, recurse
        Object.assign(filesystem, this.fromTree(value, fullPath))
      }
    }

    return filesystem
  }

  /**
   * Simple project with 2 services and a shared module
   */
  static createSimpleProject(): MockFilesystem {
    return this.fromTree({
      'service-a': {
        module: {
          'provider.tf': 'provider "aws" {}',
          'main.tf': 'module "db" { source = "../../modules/database" }'
        },
        production: {
          'provider.tf': 'provider "aws" {}',
          'main.tf': 'module "app" { source = "../module" }'
        }
      },
      'service-b': {
        module: {
          'provider.tf': 'provider "aws" {}',
          'main.tf': 'resource "aws_s3_bucket" "data" {}'
        },
        production: {
          'provider.tf': 'provider "aws" {}',
          'main.tf': 'module "app" { source = "../module" }'
        }
      },
      modules: {
        database: {
          'main.tf': 'resource "aws_db_instance" "main" {}',
          'outputs.tf': 'output "endpoint" { value = "db.example.com" }'
        }
      }
    })
  }

  /**
   * Multi-domain GCP organization structure
   * Pattern: _modules/ (shared), domain-X/ (projects), nested subdomains
   */
  static createMultiDomainProject(): MockFilesystem {
    return this.fromTree({
      _modules: {
        'multi-env-projects': {
          'folder.tf': 'resource "google_folder" "main" {}',
          'locals.tf': 'locals { env = "prod" }',
          'outputs.tf': 'output "folder_id" { value = google_folder.main.id }',
          'projects.tf': 'resource "google_project" "main" {}',
          'provider.tf': 'provider "google" {}',
          'remote_states.tf': 'data "terraform_remote_state" "org" {}',
          'variables.tf': 'variable "domain" {}'
        },
        project: {
          'main.tf': 'resource "google_project" "main" {}',
          'outputs.tf':
            'output "project_id" { value = google_project.main.id }',
          'provider.tf': 'provider "google" {}',
          'remote_states.tf':
            'data "terraform_remote_state" "folder" { backend = "gcs" }',
          'services.tf': 'resource "google_project_service" "apis" {}',
          'variables.tf': 'variable "project_name" {}'
        }
      },
      'billing_accounts.tf': 'resource "google_billing_account" "main" {}',
      'default_values.tf': 'locals { org_id = "123456789" }',
      'domain-A': {
        'folder.tf':
          'module "folder" { source = "../_modules/multi-env-projects" }',
        'outputs.tf': 'output "projects" { value = ["project1", "project2"] }',
        'project1.tf': 'module "p1" { source = "../_modules/project" }',
        'project2.tf': 'module "p2" { source = "../_modules/project" }',
        'project3.tf': 'module "p3" { source = "../_modules/project" }',
        'provider.tf': 'provider "google" {}',
        'remote_states.tf': 'data "terraform_remote_state" "org" {}'
      },
      'domain-B': {
        'folder.tf':
          'module "folder" { source = "../_modules/multi-env-projects" }',
        'outputs.tf': 'output "projects" {}',
        'project1.tf': 'module "p1" { source = "../_modules/project" }',
        'provider.tf': 'provider "google" {}',
        'remote_states.tf': 'data "terraform_remote_state" "org" {}',
        'subdomain-I': {
          'folder.tf':
            'module "folder" { source = "../../_modules/multi-env-projects" }',
          'outputs.tf': 'output "projects" {}',
          'project1.tf': 'module "p1" { source = "../../_modules/project" }',
          'project2.tf': 'module "p2" { source = "../../_modules/project" }',
          'provider.tf': 'provider "google" {}',
          'remote_states.tf': 'data "terraform_remote_state" "parent" {}'
        },
        'subdomain-II': {
          'folder.tf':
            'module "folder" { source = "../../_modules/multi-env-projects" }',
          'outputs.tf': 'output "projects" {}',
          'project1.tf': 'module "p1" { source = "../../_modules/project" }',
          'project2.tf': 'module "p2" { source = "../../_modules/project" }',
          'provider.tf': 'provider "google" {}',
          'remote_states.tf': 'data "terraform_remote_state" "parent" {}'
        }
      },
      infrastructure: {
        'ci-cd.tf': 'resource "google_project" "cicd" {}',
        'folder.tf':
          'module "folder" { source = "../_modules/multi-env-projects" }',
        'outputs.tf': 'output "state_bucket" {}',
        'provider.tf': 'provider "google" {}',
        'remote_states.tf': 'data "terraform_remote_state" "org" {}',
        'terraform-states.tf': 'resource "google_storage_bucket" "tfstate" {}'
      },
      'organization.tf':
        'resource "google_organization" "org" { domain = "example.com" }',
      'provider.tf': 'provider "google" {}',
      'README.md': '# Terraform GCP Organization'
    })
  }

  /**
   * AWS multi-environment microservices structure
   * Pattern: shared modules/, services with env dirs, cross-service dependencies
   */
  static createMicroservicesProject(): MockFilesystem {
    return this.fromTree({
      modules: {
        vpc: {
          'main.tf': 'resource "aws_vpc" "main" {}',
          'outputs.tf': 'output "vpc_id" { value = aws_vpc.main.id }',
          'variables.tf': 'variable "cidr_block" {}'
        },
        'eks-cluster': {
          'main.tf':
            'resource "aws_eks_cluster" "main" {}\nmodule "vpc" { source = "../vpc" }',
          'outputs.tf': 'output "cluster_endpoint" {}',
          'variables.tf': 'variable "cluster_name" {}'
        },
        rds: {
          'main.tf': 'resource "aws_db_instance" "main" {}',
          'outputs.tf': 'output "endpoint" {}',
          'variables.tf': 'variable "engine" {}'
        }
      },
      services: {
        'api-gateway': {
          module: {
            'main.tf': 'module "vpc" { source = "../../../modules/vpc" }',
            'outputs.tf': 'output "api_endpoint" {}',
            'provider.tf': 'provider "aws" {}'
          },
          dev: {
            'main.tf': 'module "api" { source = "../module" }',
            'provider.tf': 'provider "aws" { region = "us-east-1" }'
          },
          staging: {
            'main.tf': 'module "api" { source = "../module" }',
            'provider.tf': 'provider "aws" { region = "us-east-1" }'
          },
          prod: {
            'main.tf': 'module "api" { source = "../module" }',
            'provider.tf': 'provider "aws" { region = "us-east-1" }'
          }
        },
        'user-service': {
          module: {
            'main.tf':
              'module "vpc" { source = "../../../modules/vpc" }\nmodule "db" { source = "../../../modules/rds" }',
            'outputs.tf': 'output "service_url" {}',
            'provider.tf': 'provider "aws" {}'
          },
          dev: {
            'main.tf': 'module "users" { source = "../module" }',
            'provider.tf': 'provider "aws" { region = "us-east-1" }'
          },
          prod: {
            'main.tf': 'module "users" { source = "../module" }',
            'provider.tf': 'provider "aws" { region = "us-east-1" }'
          }
        },
        platform: {
          module: {
            'main.tf':
              'module "vpc" { source = "../../../modules/vpc" }\nmodule "eks" { source = "../../../modules/eks-cluster" }',
            'outputs.tf': 'output "k8s_endpoint" {}',
            'provider.tf': 'provider "aws" {}'
          },
          dev: {
            'main.tf': 'module "platform" { source = "../module" }',
            'provider.tf': 'provider "aws" { region = "us-east-1" }'
          },
          prod: {
            'main.tf': 'module "platform" { source = "../module" }',
            'provider.tf': 'provider "aws" { region = "us-east-1" }'
          }
        }
      },
      global: {
        'iam.tf': 'resource "aws_iam_role" "deployer" {}',
        'provider.tf': 'provider "aws" {}',
        'route53.tf': 'resource "aws_route53_zone" "main" {}'
      }
    })
  }

  /**
   * Flat multi-account structure
   * Pattern: account-X/ directories at root, shared-modules/
   */
  static createMultiAccountProject(): MockFilesystem {
    return this.fromTree({
      'shared-modules': {
        networking: {
          'main.tf': 'resource "aws_vpc" "main" {}',
          'outputs.tf': 'output "vpc_id" {}',
          'variables.tf': 'variable "cidr" {}'
        },
        security: {
          'main.tf': 'resource "aws_security_group" "main" {}',
          'outputs.tf': 'output "sg_id" {}',
          'variables.tf': 'variable "rules" {}'
        }
      },
      'account-production': {
        'main.tf':
          'module "network" { source = "../shared-modules/networking" }\nmodule "security" { source = "../shared-modules/security" }',
        'provider.tf':
          'provider "aws" { assume_role { role_arn = "arn:..." } }',
        'backend.tf': 'terraform { backend "s3" {} }'
      },
      'account-staging': {
        'main.tf':
          'module "network" { source = "../shared-modules/networking" }',
        'provider.tf':
          'provider "aws" { assume_role { role_arn = "arn:..." } }',
        'backend.tf': 'terraform { backend "s3" {} }'
      },
      'account-dev': {
        'main.tf':
          'module "network" { source = "../shared-modules/networking" }',
        'provider.tf':
          'provider "aws" { assume_role { role_arn = "arn:..." } }',
        'backend.tf': 'terraform { backend "s3" {} }'
      },
      'account-shared-services': {
        'main.tf': 'resource "aws_s3_bucket" "logs" {}',
        'provider.tf':
          'provider "aws" { assume_role { role_arn = "arn:..." } }',
        'backend.tf': 'terraform { backend "s3" {} }'
      }
    })
  }
}
