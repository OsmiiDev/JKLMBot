module.exports = {
    'env': {
        'browser': true,
        'es2021': true,
        'node': true,
    },
    'extends': ['eslint:recommended', 'google', 'plugin:@typescript-eslint/recommended'],
    'overrides': [],
    'parser': '@typescript-eslint/parser',
    'parserOptions': {'ecmaVersion': 'latest', 'sourceType': 'module'},
    'plugins': ['@typescript-eslint'],
    'rules': {
        'indent': ['error', 4],
        'linebreak-style': ['error', 'unix'],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'max-len': ['error', 200],
        'space-infix-ops': ['error', {'int32Hint': false}],
        '@typescript-eslint/no-non-null-assertion': ['off'],
    },
};

