/*
 * HEALTH ROUTE FILE
 *
 * This is a tiny "Are you alive?" endpoint.
 * Tools like uptime monitors (or us during debugging) can hit this
 * to check if the server is running.
 */

import { Router } from 'express'
import { getHealthCheck } from '../controllers/healthController.js'

const router = Router()

router.get('/', getHealthCheck)

if (process.env.NODE_ENV !== 'production') {
  router.get('/sentry-test', () => {
    throw new Error('Sentry server test event')
  })
}

export default router
