module.exports = function withPickerFix(config) {
    return {
      ...config,
      android: {
        ...config.android,
        extraGradleProperties: {
          REACT_NATIVE_NODE_MODULES_DIR: "../../node_modules",
        },
      },
    };
  };
  