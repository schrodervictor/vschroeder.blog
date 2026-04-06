terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
    spaceship = {
      source  = "namecheap/spaceship"
      version = "~> 0.0"
    }
  }

  backend "gcs" {
    # Bucket name is set via -backend-config at init time:
    #   terraform init -backend-config="bucket=<project-id>-infra-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = local.project_id
  region  = local.region
}

provider "google-beta" {
  project = local.project_id
  region  = local.region
}

# Authenticates via SPACESHIP_API_KEY and SPACESHIP_API_SECRET env vars.
provider "spaceship" {}
