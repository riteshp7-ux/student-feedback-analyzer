const packageInfo = require('../package.json');

function getApiMetadata(buildId = process.env.BUILD_ID || packageInfo.version) {
  return { apiVersion: 'v1', buildId };
}

module.exports = { getApiMetadata };
