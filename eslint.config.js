module.exports = [
  {
    files: ["src/**/*.js","src/**/*.ts","eslint.config.js"],
    rules: {
      "semi": "error",
      "editorconfig/charset": "error",
      "editorconfig/eol-last": "error",
      "editorconfig/indent": ["error", { "SwitchCase": 1 }],
      "editorconfig/linebreak-style": "error",
      "editorconfig/no-trailing-spaces": "error",
    },
    plugins: {
      editorconfig: require('eslint-plugin-editorconfig'),
    }
  }
];
