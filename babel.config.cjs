module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          node: "18"
        },
        modules: false // Let plugins handle module transformation
      }
    ]
  ],
  ignore: ["**/*.d.ts"]
};
