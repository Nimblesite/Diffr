# agent-pmo:a72c926
# =============================================================================
# Standard Makefile — Diffr (VSCode extension, TypeScript)
# Cross-platform: Linux, macOS, Windows (via GNU Make)
# =============================================================================

.PHONY: build test lint fmt clean ci setup package rebuild-install-vsix help

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

# ---------------------------------------------------------------------------
# Packaging — ONE recipe builds the VSIX, shared by `test`, `package`,
# `rebuild-install-vsix`, and release.yml. The bytes tests certify are the
# bytes users install. See REPO-STANDARDS-SPEC [MAKE-IDE-EXT-PARITY].
# ---------------------------------------------------------------------------
VSIX_PUBLISHER := nimblesite
VSIX_NAME := diffr
VSIX_VERSION := $(shell node -p "require('./package.json').version")
VSIX_FILE := $(VSIX_NAME)-$(VSIX_VERSION).vsix

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

## test: Package the shipped VSIX, verify its contents, then run fail-fast
##       tests + coverage + threshold enforcement. Packaging runs FIRST so the
##       suite never certifies a bundle the release does not ship.
##       See REPO-STANDARDS-SPEC [TEST-RULES] and [MAKE-IDE-EXT-PARITY].
test: _vsix_package _vsix_verify
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

# The single packaging recipe. `test`, `package`, `rebuild-install-vsix`, and
# release.yml all route through it — there is no second "test build".
_vsix_package: build
	@echo "==> Packaging VSIX ($(VSIX_FILE))..."
	npx vsce package --out "$(VSIX_FILE)"

# Asserts the packaged bundle matches shipwright.json ([SWR-VSIX-VERIFY]):
# required entries present, nothing forbidden shipped.
_vsix_verify:
	@node scripts/verify-vsix.mjs "$(VSIX_FILE)"

_vsix_uninstall:
	@echo "==> Uninstalling $(VSIX_PUBLISHER).$(VSIX_NAME) (ignored if absent)..."
	-code --uninstall-extension $(VSIX_PUBLISHER).$(VSIX_NAME)

_vsix_install:
	@echo "==> Installing $(VSIX_FILE)..."
	code --install-extension "$(VSIX_FILE)"

# =============================================================================
# Repo-Specific Targets
#
# Targets below this line are specific to this repo and are NOT part of the
# standard target interface.
# =============================================================================

## package: Build and verify the .vsix bundle via vsce
package: _vsix_package _vsix_verify

## rebuild-install-vsix: Full uninstall -> clean -> build -> package -> verify
##                       -> install cycle. See REPO-STANDARDS-SPEC [MAKE-IDE-EXT].
rebuild-install-vsix: _vsix_uninstall clean _vsix_package _vsix_verify _vsix_install
	@echo "==> $(VSIX_FILE) rebuilt and installed. Reload VS Code to pick it up."

## help: List all available targets
help:
	@echo "Standard targets:"
	@echo "  build   - Compile TypeScript to out/"
	@echo "  test    - Package + verify the VSIX, then fail-fast tests + coverage"
	@echo "  lint    - ESLint + tsc --noEmit + shipwright.json schema check"
	@echo "  fmt     - Format code in-place (CHECK=1 for read-only CI check)"
	@echo "  clean   - Remove build artifacts and VSIX files"
	@echo "  ci      - lint + test + build (full CI simulation)"
	@echo "  setup   - Install npm dependencies"
	@echo ""
	@echo "Repo-specific targets:"
	@echo "  package               - Build and verify the .vsix bundle"
	@echo "  rebuild-install-vsix  - Uninstall, rebuild, package, verify, reinstall"
