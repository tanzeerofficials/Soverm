/*
 * Notification navigation — maps proactive alerts to the right in-app
 * destination (dashboard focus, expense analyzer tab, category highlight).
 */

const TRIGGER_TYPES = {
  LARGE_TRANSACTION: 'large_transaction',
  LOW_BALANCE: 'low_balance',
  NEW_RECURRING_CHARGE: 'new_recurring_charge',
  SPENDING_SPIKE: 'spending_spike',
}

export function parseNotificationRelatedData(relatedData) {
  if (!relatedData) {
    return {}
  }

  if (typeof relatedData === 'string') {
    try {
      return JSON.parse(relatedData)
    } catch {
      return {}
    }
  }

  return relatedData
}

function buildSearch(params) {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      query.set(key, String(value))
    }
  }

  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
}

export function resolveNotificationTarget(notification) {
  const related = parseNotificationRelatedData(notification?.related_data)
  const triggerType = notification?.trigger_type

  switch (triggerType) {
    case TRIGGER_TYPES.LOW_BALANCE:
      return { pathname: '/dashboard', search: buildSearch({ focus: 'balance' }) }
    case TRIGGER_TYPES.NEW_RECURRING_CHARGE:
      return { pathname: '/expense-analyzer', search: buildSearch({ tab: 'recurring' }) }
    case TRIGGER_TYPES.SPENDING_SPIKE:
      return {
        pathname: '/expense-analyzer',
        search: buildSearch({
          tab: 'categories',
          highlight: related.category ?? '',
        }),
      }
    case TRIGGER_TYPES.LARGE_TRANSACTION:
      return { pathname: '/expense-analyzer', search: buildSearch({ tab: 'overview' }) }
    default:
      break
  }

  const legacyLink = related.link

  if (legacyLink === '/dashboard') {
    return { pathname: '/dashboard', search: buildSearch({ focus: 'balance' }) }
  }

  if (legacyLink === '/expense-analyzer') {
    return { pathname: '/expense-analyzer', search: buildSearch({ tab: 'overview' }) }
  }

  if (typeof legacyLink === 'string' && legacyLink.startsWith('/')) {
    const [pathname, search = ''] = legacyLink.split('?')
    return { pathname, search: search ? `?${search}` : '' }
  }

  return { pathname: '/expense-analyzer', search: buildSearch({ tab: 'overview' }) }
}

export function notificationActionLabel(notification) {
  const triggerType = notification?.trigger_type

  switch (triggerType) {
    case TRIGGER_TYPES.LOW_BALANCE:
      return 'View balance'
    case TRIGGER_TYPES.NEW_RECURRING_CHARGE:
      return 'View subscriptions'
    case TRIGGER_TYPES.SPENDING_SPIKE:
      return 'View category'
    case TRIGGER_TYPES.LARGE_TRANSACTION:
      return 'View spending'
    default:
      return 'View details'
  }
}

export function navigateToNotification(navigate, notification) {
  const target = resolveNotificationTarget(notification)
  navigate({ pathname: target.pathname, search: target.search })
}

export function isDashboardNotification(notification) {
  const target = resolveNotificationTarget(notification)
  return target.pathname === '/dashboard'
}
