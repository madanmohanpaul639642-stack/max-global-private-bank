const serverless = require('serverless-http');
const { app, start } = require('../../server');

// Wrap Express app with serverless-http
const handler = serverless(app);

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // Normalize Netlify function path redirect
  if (event.path && event.path.startsWith('/.netlify/functions/api')) {
    event.path = event.path.replace('/.netlify/functions/api', '/api') || '/api';
  }

  return await handler(event, context);
};
