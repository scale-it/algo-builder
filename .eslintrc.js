module.exports = {
  env: {
    node: true,
    es6: true,
  },
  plugins: ["simple-import-sort", "sonarjs"],
  extends: [
    // "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:sonarjs/recommended"
  ],
  parserOptions: {
    project: "./tsconfig.json",
    ecmaVersion: 2019,
    // sourceType: "module"
  },
  rules:  {
    // "ter-indent": [2, {"FunctionDeclaration": {"parameters": "first"}}],

    "sort-imports": "off",
    "import/no-extraneous-dependencies": 0,
    "import/prefer-default-export": "off",
    "simple-import-sort/sort": "warn",
    "max-classes-per-file": 0,

    "no-underscore-dangle": 0,
    "@typescript-eslint/no-unused-vars": ["warn", { "vars": "all", "args": "none", "ignoreRestSiblings": false, "varsIgnorePattern": "_" }],

    "sonarjs/cognitive-complexity": ["error", 16]
  }
}
