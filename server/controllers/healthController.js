/*
 * getHealthCheck
 *
 * What it does:
 * - Sends back a simple JSON message saying the API is running.
 *
 * Why we need it:
 * - Fast way to test the server without needing login, Plaid, or database writes.
 *
 * How it fits the app:
 * - GET / (through health route) is the first sanity check when debugging.
 */
export function getHealthCheck(_req, res) {
  res.json({ message: 'CFO Agent API is running' })
}
