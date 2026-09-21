import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // shadcn/ui primitives intentionally co-export variants/helpers with components.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Test helpers export utilities alongside components; fast refresh does not apply to tests.
    files: ["src/test/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // The auth module deliberately exposes the provider component and its hook together.
    files: ["src/hooks/useAuth.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
);
