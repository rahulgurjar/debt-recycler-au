/**
 * Lambda handler wrapper for Express API
 * Converts API Gateway events to Express-compatible format
 */

const serverless = require('serverless-http');
const app = require('./api');

// Wrap Express app for Lambda
const handler = serverless(app, {
  request: (request, event, context) => {
    request.context = event.requestContext;
    request.event = event;
  },
});

module.exports = { handler };
