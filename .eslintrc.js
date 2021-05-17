module.exports = {
  env: {
    node: true,
    es6: true,
    es2020: true,
    mocha: true
  },
  plugins: ["simple-import-sort", "sonarjs"],
  extends: [
    "standard-with-typescript",
    "plugin:sonarjs/recommended"
  ],
  parserOptions: {
    project: "./tsconfig.json",
    ecmaVersion: 2020,
    // sourceType: "module"
  },
  rules:  {
    // "ter-indent": [2, {"FunctionDeclaration": {"parameters": "first"}}],

    "import/no-extraneous-dependencies": 0,
    "import/prefer-default-export": "off",
    "max-classes-per-file": 0,
    "max-len": ["error", { "code": 110, "ignoreTrailingComments": true, "ignoreUrls": true, "ignoreStrings": true, "ignoreTemplateLiterals": true}],
    "no-underscore-dangle": 0,
    "simple-import-sort/sort": "warn",
    "sort-imports": "off",

    "@typescript-eslint/consistent-type-assertions": "off",
    "@typescript-eslint/promise-function-async": "off",
    "@typescript-eslint/no-dynamic-delete": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { "vars": "all", "args": "none", "ignoreRestSiblings": false, "varsIgnorePattern": "_" }],
    "@typescript-eslint/quotes": "off",
    "semi": "off",  // required for a proper work
    "@typescript-eslint/semi": ["error", "always"],
    "@typescript-eslint/strict-boolean-expressions": "off",
    "sonarjs/cognitive-complexity": ["error", 16]
  }
}
