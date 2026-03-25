/**
 * Local development server for Debt Recycler API
 */

const app = require('./api');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`\n✓ Debt Recycler API running on http://${HOST}:${PORT}`);
  console.log(`✓ Health check: http://${HOST}:${PORT}/health\n`);
});
