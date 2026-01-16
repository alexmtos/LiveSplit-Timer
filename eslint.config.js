import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        // DOM globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        WebSocket: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        localStorage: 'readonly',
        JSON: 'readonly',
        Math: 'readonly',
        Date: 'readonly',
        Set: 'readonly',
        Map: 'readonly',
        Promise: 'readonly',
        Error: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        html2canvas: 'readonly'
      }
    },
    rules: {
      // Style rules matching codebase conventions
      'indent': ['error', 4, { 'SwitchCase': 1 }],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'never'],
      'no-trailing-spaces': 'error',
      'no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 0 }],
      'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
      'no-undef': 'warn',

      // Allow console logs (used for logging in this project)
      'no-console': 'off',

      // Disallow reassigning constants
      'no-const-assign': 'error',

      // Prevent accidental type coercion
      'eqeqeq': ['error', 'always'],

      // Block redeclared variables
      'no-redeclare': 'error',

      // No empty catch blocks
      'no-empty': ['error', { 'allowEmptyCatch': false }],

      // Prevent var (use const/let)
      'no-var': 'error',
      'prefer-const': 'warn',

      // Line length (soft limit, allow long URLs/strings)
      'max-len': 'off',

      // Curly braces on same line
      'brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
      'curly': ['error', 'all'],

      // Spacing
      'keyword-spacing': 'error',
      'space-before-blocks': 'error',
      'space-infix-ops': 'error',
      'space-unary-ops': 'error',

      // Newlines
      'no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 0 }],

      // Naming conventions
      'camelcase': ['warn', { 'allow': ['^[a-z][a-zA-Z0-9]*$'] }],

      // Prevent common errors
      'no-debugger': 'error',

      // Async/await and promises
      'no-promise-executor-return': 'error',
      'no-return-await': 'warn',

      // Best practices
      'no-else-return': 'warn',
      'no-floating-decimal': 'error',
      'no-sequences': 'error',
      'no-self-compare': 'error',
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error'
    }
  }
];
