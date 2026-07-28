// agent-pmo:74cf183
// @ts-check
//
// MAX-STRICTNESS ESLint config:
//   - tseslint strictTypeChecked + stylisticTypeChecked baselines
//   - every safe extra rule promoted to "error" (no warns)
//   - no exceptions, no per-file disables

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const SDK_FREE_MESSAGE =
  "src/git/ and src/ui/uri.ts must stay SDK-free. Keep vscode access in the thin shells that wrap them.";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Type-safety hard rules (no `any`, no unsafe ops, no non-null !)
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-confusing-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "error",
      "@typescript-eslint/no-unnecessary-template-expression": "error",
      "@typescript-eslint/no-unnecessary-type-arguments": "error",
      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/no-duplicate-type-constituents": "error",
      "@typescript-eslint/no-duplicate-enum-values": "error",
      "@typescript-eslint/no-mixed-enums": "error",
      "@typescript-eslint/no-meaningless-void-operator": "error",
      "@typescript-eslint/no-invalid-void-type": "error",
      "@typescript-eslint/no-confusing-void-expression": "error",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-dynamic-delete": "error",
      "@typescript-eslint/no-extraneous-class": "error",
      "@typescript-eslint/no-for-in-array": "error",
      "@typescript-eslint/no-useless-empty-export": "error",
      "@typescript-eslint/no-misused-spread": "error",
      "@typescript-eslint/no-unsafe-unary-minus": "error",
      "@typescript-eslint/no-array-delete": "error",
      // Every `as` must be provably safe, not merely asserted.
      "@typescript-eslint/no-unsafe-type-assertion": "error",
      // Deprecated APIs are legacy; legacy is deleted.
      "@typescript-eslint/no-deprecated": "error",

      // Explicit signatures: every return type annotated, no wide param lists
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/max-params": ["error", { max: 3 }],

      // Async / Promise safety
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/return-await": ["error", "always"],
      "@typescript-eslint/require-await": "error",

      // Boolean / nullish clarity
      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",

      // Idiomatic patterns
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/prefer-find": "error",
      "@typescript-eslint/prefer-includes": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/prefer-reduce-type-parameter": "error",
      "@typescript-eslint/prefer-return-this-type": "error",
      "@typescript-eslint/prefer-string-starts-ends-with": "error",
      "@typescript-eslint/prefer-for-of": "error",
      "@typescript-eslint/prefer-function-type": "error",
      "@typescript-eslint/prefer-literal-enum-member": "error",
      "@typescript-eslint/unified-signatures": "error",
      "@typescript-eslint/require-array-sort-compare": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/restrict-plus-operands": "error",
      "@typescript-eslint/restrict-template-expressions": "error",

      // Imports + naming
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/method-signature-style": ["error", "property"],

      // Errors are typed, not strings
      "no-throw-literal": "off",
      "@typescript-eslint/only-throw-error": "error",

      // Plain JS hygiene
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "no-console": "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-debugger": "error",
      "no-alert": "error",
      "no-param-reassign": ["error", { props: true }],
      "no-eval": "error",
      "no-implied-eval": "off",
      "@typescript-eslint/no-implied-eval": "error",
      "no-return-assign": "error",
      "no-self-compare": "error",
      "no-unmodified-loop-condition": "error",
      "no-unreachable-loop": "error",
      "no-useless-concat": "error",
      "no-useless-return": "error",
      "prefer-template": "error",
      "object-shorthand": "error",
    },
  },
  {
    // Portability firewall: these modules must stay pure so they can move to
    // another editor/host verbatim. Type-only imports count — they still bind
    // the module's shape to the SDK.
    files: ["src/git/**/*.ts", "src/ui/uri.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { paths: [{ name: "vscode", message: SDK_FREE_MESSAGE }] },
      ],
      // no-restricted-imports only walks static import/export nodes, so a
      // dynamic `await import("vscode")` would slip through and bind these
      // modules to the SDK at runtime with no diagnostic.
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression[source.value='vscode']",
          message: SDK_FREE_MESSAGE,
        },
        {
          selector: "CallExpression[callee.name='require'][arguments.0.value='vscode']",
          message: SDK_FREE_MESSAGE,
        },
      ],
    },
  },
  {
    // Scripts and bundler config are JS — they don't get TS rules.
    ignores: [
      "out/",
      "dist/",
      "**/*.d.ts",
      "node_modules/",
      "coverage/",
      ".vscode-test/",
      "**/*.js",
      "**/*.mjs",
    ],
  },
);
