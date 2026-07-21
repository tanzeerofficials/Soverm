/*
 * HEALTH ROUTE FILE
 *
 * This is a tiny "Are you alive?" endpoint.
 * Tools like uptime monitors (or us during debugging) can hit this
 * to check if the server is running.
 */

import { Router } from 'express'
import { getHealthCheck } from '../controllers/healthController.js'
import { areDevEndpointsEnabled } from '../utils/runtimeFlags.js'

const router = Router()

router.get('/', getHealthCheck)

// Opt-in only — do not gate on NODE_ENV alone (missing NODE_ENV on Railway
// used to expose this in production).
if (areDevEndpointsEnabled()) {
  router.get('/sentry-test', () => {
    throw new Error('Sentry server test event')
  })
}

export default router
