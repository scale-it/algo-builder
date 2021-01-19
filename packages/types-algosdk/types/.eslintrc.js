module.exports = {
  extends: [
    "../../.eslintrc.js"
  ],
  rules: {
    "max-len": ["error", { "code": 200}],

    "@typescript-eslint/member-delimiter-style": ["error", {
      multiline: {
        delimiter: 'semi',    // 'none' or 'semi' or 'comma'
        requireLast: true,
      },
      singleline: {
        delimiter: 'semi',    // 'semi' or 'comma'
        requireLast: false,
      },
      "overrides": {
        "interface": {
          "multiline": {
            "delimiter": "semi",
            "requireLast": true
          }
        },
        "typeLiteral": {
          "multiline": {
            "delimiter": "semi",
            "requireLast": true
          }
        }
      }
    }],

    "@typescript-eslint/space-before-function-paren": ["error", "never"],
    "@typescript-eslint/no-unused-vars": "off"
  }
}
