module.exports = {
  env: {
    node: true,
    es6: true,
  },
  plugins: ["simple-import-sort", "sonarjs"],
  extends: [
    "standard-with-typescript",
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

    "@typescript-eslint/semi": ["error", "always"],
    "@typescript-eslint/quotes": "off",
    "@typescript-eslint/no-dynamic-delete": "off",
    "@typescript-eslint/strict-boolean-expressions": "off",
    "max-len": ["error", { "code": 110, "ignoreTrailingComments": true, "ignoreUrls": true, "ignoreStrings": true, "ignoreTemplateLiterals": true}],

    "sonarjs/cognitive-complexity": ["error", 16]
  }
}
