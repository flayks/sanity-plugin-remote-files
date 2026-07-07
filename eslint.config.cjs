const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const reactPlugin = require("eslint-plugin-react");
const reactHooksPlugin = require("eslint-plugin-react-hooks");

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
	{
		ignores: [
			"*.js",
			".eslintrc",
			".eslintrc.js",
			"commitlint.config.js",
			"dist",
			"lint-staged.config.js",
			"package.config.ts"
		]
	},
	{
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2022,
			sourceType: "module",
			parserOptions: { project: false, ecmaFeatures: { jsx: true } }
		},
		plugins: {
			"@typescript-eslint": tsPlugin,
			react: reactPlugin,
			"react-hooks": reactHooksPlugin
		},
		settings: { react: { version: "detect" } },
		rules: { "react/react-in-jsx-scope": "off" }
	}
];


