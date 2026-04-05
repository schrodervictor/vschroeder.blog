.PHONY: dev build preview clean check update

node_modules: package-lock.json
	npm ci
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

# Type check only
check: node_modules
	npm run check

# Update dependencies
# Only versions at least 7 days old to mitigate supply chain attacks
update:
	npm update --before="$$(date -d '7 days ago' +%Y-%m-%d)"
	@touch node_modules

# Remove build artifacts
clean:
	rm -rf dist .astro node_modules
