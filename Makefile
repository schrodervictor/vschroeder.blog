.PHONY: dev build preview deploy clean check test update bootstrap tf-init tf-apply

TF      ?= terraform
PROJECT := vschroeder-blog
BILLING ?=
REGION  := europe-west10

node_modules: package-lock.json
	npm clean-install
	@touch node_modules

# Local development server
dev: node_modules
	npm run dev

# Type check and build to dist/
build: node_modules
	npm run build

# Serve the built site locally
preview: node_modules
	npm run preview

# Deploy to Firebase Hosting
deploy: build
	firebase deploy --only hosting --project '$(PROJECT)'

# Type check only
check: node_modules
	npm run check

# Run unit tests
test: node_modules
	npm test

# Update dependencies
# Only versions at least 7 days old to mitigate supply chain attacks
update:
	npm update --before="$$(date -d '7 days ago' +%Y-%m-%d)"
	@touch node_modules

# One-time GCP project bootstrap
# Usage: make bootstrap BILLING=<billing-account-id>
bootstrap:
ifndef BILLING
	$(error BILLING is required. Usage: make bootstrap BILLING=<billing-account-id>)
endif
	./scripts/bootstrap.sh '$(PROJECT)' '$(BILLING)' '$(REGION)'

# Initialize Terraform backend
tf-init:
	cd infra/tf && $(TF) init -backend-config='bucket=$(PROJECT)-infra-state'

# Apply Terraform configuration
tf-apply:
	cd infra/tf && $(TF) apply

# Remove build artifacts
clean:
	rm -rf dist .astro node_modules
