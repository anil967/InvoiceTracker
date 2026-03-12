import react from "eslint-plugin-react";

export default [
    {
        files: ["**/*.js", "**/*.jsx"],
        plugins: {
            react
        },
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: {
                    jsx: true
                }
            }
        },
        settings: {
            react: {
                version: "detect"
            }
        },
        rules: {
            "no-unused-vars": ["warn", {
                varsIgnorePattern: "^_",
                argsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_"
            }],
            "react/jsx-uses-react": "error",
            "react/jsx-uses-vars": "error"
        }
    }
];
