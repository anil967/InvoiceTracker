export default {
    rootDir: './',
    testEnvironment: 'node',
    transform: {
        '^.+\\.(js|jsx|mjs)$': 'babel-jest',
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
};


