# agent-pmo:74cf183
# =============================================================================
# Standard Makefile — Diffr (VSCode extension, TypeScript)
# Cross-platform: Linux, macOS, Windows (via GNU Make)
# =============================================================================

.PHONY: build test lint fmt clean ci setup package help

# ---------------------------------------------------------------------------
# OS Detection
# ---------------------------------------------------------------------------
ifeq ($(OS),Windows_NT)
  SHELL := powershell.exe
  .SHELLFLAGS := -NoProfile -Command
  RM = Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  MKDIR = New-Item -ItemType Directory -Force
  HOME ?= $(USERPROFILE)
else
  RM = rm -rf
  MKDIR = mkdir -p
endif

# ---------------------------------------------------------------------------
# Coverage — single source of truth is coverage-thresholds.json
# See REPO-STANDARDS-SPEC [COVERAGE-THRESHOLDS-JSON].
# ---------------------------------------------------------------------------
COVERAGE_THRESHOLDS_FILE := coverage-thresholds.json

# =============================================================================
# Standard Targets
#
# These 7 targets are portfolio-wide and identical across every repo.
# Do NOT add extra public targets here — put them in the Repo-Specific
# Targets section at the bottom of this file.
# See REPO-STANDARDS-SPEC [MAKE-TARGETS].
# =============================================================================

## build: Compile TypeScript to out/
build:
	@echo "==> Building..."
	npm run build

## test: Fail-fast tests + coverage + threshold enforcement.
##       See REPO-STANDARDS-SPEC [TEST-RULES] and [COVERAGE-THRESHOLDS-JSON].
test:
	@echo "==> Testing (fail-fast + coverage + threshold)..."
	npm run test:coverage
	$(MAKE) _coverage_check

## lint: ESLint + tsc --noEmit + shipwright.json schema check (read-only). No formatting.
lint:
	@echo "==> Linting..."
	npm run lint
	npm run typecheck
	npm run shipwright:validate

## fmt: Prettier in-place. Pass CHECK=1 for read-only check (CI use).
fmt:
	@echo "==> Formatting$(if $(CHECK), (check mode),)..."
	npm run fmt$(if $(CHECK),:check,)

## clean: Remove all build artifacts
clean:
	@echo "==> Cleaning..."
	$(RM) out dist coverage .vscode-test .nyc_output *.vsix build-info.json

## ci: lint + test + build (full CI simulation)
ci: lint test build

## setup: Post-create dev environment setup (used by devcontainer)
setup:
	@echo "==> Setting up development environment..."
	npm ci
	@echo "==> Setup complete. Run 'make ci' to validate."

# ---------------------------------------------------------------------------
# Internal sub-recipes — underscore-prefixed, NOT in .PHONY, NOT public.
# ---------------------------------------------------------------------------

_coverage_check:
	@node scripts/check-coverage-threshold.mjs

## help: List all available targets
help:
	@echo "Standard targets:"
	@echo "  build   - Compile TypeScript to out/"
	@echo "  test    - Fail-fast tests + coverage + threshold enforcement"
	@echo "  lint    - ESLint + tsc --noEmit (read-only, no formatting)"
	@echo "  fmt     - Format code in-place (CHECK=1 for read-only CI check)"
	@echo "  clean   - Remove build artifacts and VSIX files"
	@echo "  ci      - lint + test + build (full CI simulation)"
	@echo "  setup   - Install npm dependencies"
	@echo ""
	@echo "Repo-specific targets:"
	@echo "  package - Build the .vsix bundle via vsce"

# =============================================================================
# Repo-Specific Targets
#
# Targets below this line are specific to this repo and are NOT part of the
# standard 7-target interface.
# =============================================================================

## package: Build the .vsix bundle via vsce
package: build
	@echo "==> Packaging VSIX..."
	npx vsce package
