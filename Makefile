SHELL := /bin/bash
.PHONY: help setup dev build package publish publish-dry clean clean-dist preview lint test test-e2e test-e2e-ui test-e2e-headed test-e2e-install check-version update-deps install-dev

help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

setup: ## Install dependencies and prepare project
	@echo "Installing dependencies..."
	npm install
	@echo "Setup complete"

dev: ## Start development server with hot reload
	@echo "Starting development server..."
	npm run dev

build: ## Build for production
	@echo "Building for production..."
	npm run build
	@echo "Build complete - Files in ./dist"

package: build ## Create npm package (tarball)
	@echo "Creating package..."
	npm pack
	@echo "Package created - see above for details"

publish-dry: ## Publish to npm (dry run) (TAG=rc for pre-release)
	@echo "Running publish dry-run..."
	npm publish --dry-run $(if $(TAG),--tag $(TAG))
	@echo "Dry-run complete - Review the output above"

publish: ## Publish to npm (TAG=rc for pre-release)
	@echo "WARNING: This will publish to npm registry"
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@powershell -Command "Read-Host | Out-Null"
	@echo "Publishing to npm..."
	npm publish $(if $(TAG),--tag $(TAG))
	@echo "Published successfully"

clean: ## Clean build artifacts and node_modules
	@echo "Cleaning build artifacts..."
	npm run clean
	@echo "Clean complete"

clean-dist: ## Clean only dist folder
	@echo "Cleaning dist folder..."
	npm run clean:dist
	@echo "Dist cleaned"

preview: build ## Preview production build
	@echo "Starting preview server..."
	npm run preview

lint: ## Run linter (if configured)
	@echo "Linting is not configured yet"
	@echo "Consider adding ESLint in the future"

test: test-e2e ## Run all tests (alias for test-e2e)

test-e2e: ## Run Playwright e2e tests (headless)
	npm run test:e2e

test-e2e-ui: ## Open Playwright Test UI for debugging
	npm run test:e2e:ui

test-e2e-headed: ## Run Playwright e2e tests with visible browser
	npm run test:e2e:headed

test-e2e-install: ## Download Chromium browser binary (one-time setup)
	npm run test:e2e:install

check-version: ## Show current package version
	@echo "Current version:"
	@node -p "require('./package.json').version"

update-deps: ## Update dependencies
	@echo "Updating dependencies..."
	npm update
	@echo "Dependencies updated"

install-dev: ## Install as local dev dependency (for testing)
	@echo "Installing package locally..."
	npm pack
	@echo "You can now install this in another project with:"
	@echo "npm install <path-to-tgz-file>"

# Default target
.DEFAULT_GOAL := help
