#!/usr/bin/env bash
set -euo pipefail

# Bootstrap script for the blog infrastructure.
# Creates the GCP project, links billing, and creates a GCS bucket
# for Terraform state. Everything else is managed by Terraform.
# Safe to run multiple times.
#
# Usage:
#   ./scripts/bootstrap.sh <project-id> <billing-account-id> <region>
#
# Example:
#   ./scripts/bootstrap.sh my-blog 012345-6789AB-CDEF01 us-central1

msg() { printf '%s\n' "$@"; }
err() { msg "$@" >&2; }

bootstrap() {
    if [ "$#" -ne 3 ]; then
        err "Usage: $0 <project-id> <billing-account-id> <region>"
        return 1
    fi

    local project_id="$1"
    local billing_account_id="$2"
    local region="$3"
    local state_bucket="$project_id-infra-state"

    msg "==> Bootstrapping project: $project_id" \
        "    Billing account: $billing_account_id" \
        "    Region: $region" \
        "    State bucket: $state_bucket" \
        ""

    # Create GCP project
    if gcloud projects describe "$project_id" &>/dev/null; then
        msg "==> Project $project_id already exists, skipping creation."
    else
        msg "==> Creating project $project_id..."
        gcloud projects create "$project_id"
    fi

    gcloud config set project "$project_id"

    # Set up billing account
    local current_billing
    current_billing="$(
        gcloud billing projects describe "$project_id" \
            --format="value(billingAccountName)" 2>/dev/null \
        || true
    )"

    if [ "$current_billing" = "billingAccounts/$billing_account_id" ]; then
        msg "==> Billing account already linked."
    else
        msg "==> Linking billing account..."
        gcloud billing projects link "$project_id" \
            --billing-account="$billing_account_id"
    fi

    # Create TF state bucket
    if gcloud storage buckets describe "gs://$state_bucket" &>/dev/null; then
        msg "==> State bucket gs://$state_bucket already exists."
    else
        msg "==> Creating Terraform state bucket gs://$state_bucket..."
        gcloud storage buckets create "gs://$state_bucket" \
            --project="$project_id" \
            --location="$region" \
            --uniform-bucket-level-access
    fi

    # Enable versioning for state safety
    gcloud storage buckets update "gs://$state_bucket" --versioning

    msg "" \
        "==> Bootstrap complete!" \
        "" \
        "Next steps:" \
        "  1. Create infra/tf/input.auto.tfvars with your values:" \
        "     project_id         = \"$project_id\"" \
        "     region             = \"$region\"" \
        "     billing_account_id = \"$billing_account_id\"" \
        "     domain             = \"<your-domain.com>\"" \
        "" \
        "  2. Run OpenTofu/Terraform:" \
        "     $ cd infra/tf" \
        "     $ tf init -backend-config=\"bucket=$state_bucket\"" \
        "     $ tf apply"
}

if [ "$0" = "${BASH_SOURCE[0]}" ]; then
    bootstrap "$@"
fi
