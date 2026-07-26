import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";

export default [
    {
        ignores: ["node_modules/**", "main.js"],
    },
    js.configs.recommended,
    tsPlugin.configs["flat/eslint-recommended"],
    ...tsPlugin.configs["flat/recommended"],
    {
        languageOptions: {
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
            "@typescript-eslint/ban-ts-comment": "off",
            "no-prototype-builtins": "off",
            "@typescript-eslint/no-empty-function": "off",
        },
    },
];
