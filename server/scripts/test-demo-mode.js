/*
 * DEMO MODE TESTS
 *
 * Covers middleware/demoMode.js:
 * - inert without DEMO_MODE=1 (header alone does nothing)
 * - read-only policy: Plaid + mutations 403, AI allowlist passes
 * - Clerk compatibility CANARY: the branded req.auth must satisfy the REAL
 *   @clerk/express getAuth() and requireAuth() with no Clerk network call.
 *   If a Clerk upgrade changes the brand mechanism, these tests fail loudly
 *   instead of demo mode silently 401ing.
 */

import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

process.env.CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_placeholder'
process.env.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'sk_test_placeholder'

const { demoMode, isDemoRequest, DEMO_USER_ID, DEMO_HEADER } = await import(
  '../middleware/demoMode.js'
)
const { getAuth, requireAuth } = await import('@clerk/express')

function mockReq({ method = 'GET', path = '/api/dashboard/summary', demoHeader = '1' } = {}) {
  return {
    method,
    path,
    url: path,
    headers: demoHeader == null ? {} : { [DEMO_HEADER]: demoHeader },
  }
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    redirectedTo: null,
    status(code) {
      res.statusCode = code
      return res
    },
    json(payload) {
      res.body = payload
      return res
    },
    redirect(url) {
      res.redirectedTo = url
      return res
    },
  }
  return res
}

function runMiddleware(req) {
  const res = mockRes()
  let nextCalled = false
  demoMode()(req, res, () => {
    nextCalled = true
  })
  return { res, nextCalled }
}

describe('demo mode middleware', () => {
  const originalDemoMode = process.env.DEMO_MODE

  beforeEach(() => {
    process.env.DEMO_MODE = '1'
  })

  afterEach(() => {
    if (originalDemoMode === undefined) {
      delete process.env.DEMO_MODE
    } else {
      process.env.DEMO_MODE = originalDemoMode
    }
  })

  test('inert when DEMO_MODE is unset — header alone does nothing', () => {
    delete process.env.DEMO_MODE
    const req = mockReq({ method: 'POST', path: '/api/plaid/create-link-token' })
    const { res, nextCalled } = runMiddleware(req)

    assert.equal(nextCalled, true)
    assert.equal(res.statusCode, null)
    assert.equal(req.auth, undefined)
    assert.equal(isDemoRequest(req), false)
  })

  test('inert without the demo header even when DEMO_MODE=1', () => {
    const req = mockReq({ demoHeader: null })
    const { nextCalled } = runMiddleware(req)

    assert.equal(nextCalled, true)
    assert.equal(req.auth, undefined)
  })

  test('GET requests authenticate as the hardcoded demo user', () => {
    const req = mockReq()
    const { nextCalled } = runMiddleware(req)

    assert.equal(nextCalled, true)
    assert.equal(req.sovermDemo, true)
    assert.equal(typeof req.auth, 'function')
    assert.equal(req.auth().userId, DEMO_USER_ID)
  })

  test('demo user id cannot be chosen by the request', () => {
    const req = mockReq()
    req.headers['x-user-id'] = 'victim_user'
    req.headers[DEMO_HEADER] = 'victim_user' // any truthy-looking value != "1" is rejected
    const { nextCalled } = runMiddleware(req)

    assert.equal(nextCalled, true)
    assert.equal(req.auth, undefined)
  })

  test('all Plaid routes are blocked regardless of method', () => {
    for (const [method, path] of [
      ['POST', '/api/plaid/create-link-token'],
      ['POST', '/api/plaid/sync-transactions'],
      ['DELETE', '/api/plaid/accounts/abc'],
      ['GET', '/api/plaid/anything'],
    ]) {
      const { res, nextCalled } = runMiddleware(mockReq({ method, path }))
      assert.equal(nextCalled, false, `${method} ${path} must not pass`)
      assert.equal(res.statusCode, 403)
      assert.equal(res.body.error, 'demo_read_only')
    }
  })

  test('mutations outside the AI allowlist are blocked', () => {
    for (const [method, path] of [
      ['PATCH', '/api/actions/123'],
      ['DELETE', '/api/user'],
      ['POST', '/api/billing/checkout'],
      ['PUT', '/api/payday'],
      ['PATCH', '/api/notifications/preferences'],
      ['POST', '/api/trackers'],
    ]) {
      const { res, nextCalled } = runMiddleware(mockReq({ method, path }))
      assert.equal(nextCalled, false, `${method} ${path} must not pass`)
      assert.equal(res.statusCode, 403)
    }
  })

  test('AI demo features stay usable', () => {
    for (const [method, path] of [
      ['POST', '/api/insights/generate'],
      ['POST', '/api/chat/general'],
      ['POST', '/api/chat/8f14e45f-ea3c-4c2d-9c19-000000000000'],
      ['POST', '/api/before-you-spend'],
      ['POST', '/api/expense-analyzer/narrative'],
    ]) {
      const { res, nextCalled } = runMiddleware(mockReq({ method, path }))
      assert.equal(nextCalled, true, `${method} ${path} must pass`)
      assert.equal(res.statusCode, null)
    }
  })

  test('CANARY: real @clerk/express getAuth() resolves the demo user', () => {
    const req = mockReq()
    runMiddleware(req)

    const auth = getAuth(req)
    assert.equal(auth.userId, DEMO_USER_ID)
  })

  test('CANARY: real @clerk/express requireAuth() passes the branded request', async () => {
    const req = mockReq()
    runMiddleware(req)

    const res = mockRes()
    let passed = false
    await new Promise((resolve, reject) => {
      requireAuth()(req, res, (err) => {
        if (err) return reject(err)
        passed = true
        resolve()
      })
      // requireAuth redirects instead of calling next() when unauthenticated.
      setTimeout(resolve, 50)
    })

    assert.equal(passed, true, 'requireAuth must call next() for the demo session')
    assert.equal(res.redirectedTo, null)
  })
})
