module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Style rules
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],

    // Best practices
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',

    // ES6
    'arrow-spacing': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-parens': ['error', 'as-needed'],

    // Async/await
    'require-await': 'error',
    'no-return-await': 'error',
    'no-await-in-loop': 'error',

    // Error handling
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',

    // Code quality
    'complexity': ['warn', 10],
    'max-depth': ['warn', 4],
    'max-lines': ['warn', 500],
    'max-lines-per-function': ['warn', 50],
    'max-params': ['warn', 4],

    // Node.js specific
    'no-mixed-requires': 'error',
    'no-new-require': 'error',
    'no-path-concat': 'error'
  },
  overrides: [
    {
      files: ['tests/**/*.js', '**/*.test.js'],
      env: {
        jest: true
      },
      rules: {
        'no-unused-vars': 'off',
        'max-lines-per-function': 'off'
      }
    }
  ]
};