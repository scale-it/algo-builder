const unusedVarsCfg = [
	"warn",
	{ vars: "all", args: "none", ignoreRestSiblings: false, varsIgnorePattern: "_" },
];

module.exports = {
	env: {
		node: true,
		es6: true,
		es2020: true,
		mocha: true,
	},
	plugins: ["simple-import-sort", "sonarjs"],
	extends: [
		"plugin:sonarjs/recommended",
		// "plugin:import/recommended",
		// "plugin:import/typescript",
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"prettier",
	],
	parserOptions: {
		ecmaVersion: 2020,
		// sourceType: "module"
	},
	rules: {
		// "ter-indent": [2, {"FunctionDeclaration": {"parameters": "first"}}],
		"import/no-extraneous-dependencies": 0,
		"import/prefer-default-export": "off",
		"max-classes-per-file": 0,
		"max-len": [
			"error",
			{
				code: 110,
				ignoreTrailingComments: true,
				ignoreUrls: true,
				ignoreStrings: true,
				ignoreTemplateLiterals: true,
			},
		],
		"no-underscore-dangle": 0,
		"simple-import-sort/imports": "warn",
		"sort-imports": "off",

		"no-unused-vars": unusedVarsCfg,
		"@typescript-eslint/no-unused-vars": unusedVarsCfg,

		"@typescript-eslint/consistent-type-assertions": "off",
		"@typescript-eslint/no-dynamic-delete": "off",
		"sonarjs/cognitive-complexity": ["error", 16],
		"import/no-named-as-default-member": "off",
		"@typescript-eslint/no-var-requires": "off",

		// TODO: remove this rule
		"@typescript-eslint/no-explicit-any": "off",
	},
	overrides: [
		{
			files: ["**/*.js"],
			rules: {
				"@typescript-eslint/no-var-requires": "off",
			},
		},
	],
	ignorePatterns: ["**/*.json"],
};
