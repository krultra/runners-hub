// This is a custom Jest transformer for file imports
'use strict';

module.exports = {
  process() {
    return 'module.exports = {};';
  },
  getCacheKey() {
    // The output is always the same.
    return 'fileTransform';
  },
};
