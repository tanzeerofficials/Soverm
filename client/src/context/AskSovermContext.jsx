/*
 * ASK SOVERM CONTEXT
 *
 * Global floating chat so any signed-in page can open Ask Soverm in place.
 * Deep links still work via ?chat=open. openChat can pass page-aware
 * suggested prompts and a context label.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import {
  FloatingCfoChatButton,
  FloatingCfoChatModal,
} from '../components/FloatingCfoChat.jsx'
import { resolveAskSovermPageContext } from '../lib/chatSuggestedPrompts.js'
import { useToastContext } from './ToastContext.jsx'

const AskSovermContext = createContext(null)

export function AskSovermProvider({ children }) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToastContext()
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [autoSend, setAutoSend] = useState(false)
  const [suggestedPrompts, setSuggestedPrompts] = useState(null)
  const [contextLabel, setContextLabel] = useState(null)

  const routeDefaults = useMemo(
    () => resolveAskSovermPageContext(location.pathname),
    [location.pathname]
  )

  const closeChat = useCallback(() => {
    setIsOpen(false)
    setDraft('')
    setAutoSend(false)
    setSuggestedPrompts(null)
    setContextLabel(null)
  }, [])

  const openChat = useCallback(
    ({
      prompt = '',
      autoSend: shouldAutoSend,
      suggestedPrompts: prompts,
      contextLabel: label,
    } = {}) => {
      const hasPrompt = Boolean(prompt)
      const defaults = resolveAskSovermPageContext(location.pathname)

      setDraft(prompt || '')
      setAutoSend(
        shouldAutoSend === undefined ? hasPrompt : Boolean(shouldAutoSend)
      )
      setSuggestedPrompts(prompts ?? defaults.suggestedPrompts)
      setContextLabel(label ?? defaults.contextLabel)
      setIsOpen(true)
    },
    [location.pathname]
  )

  /*
   * Deep link: /any-route?chat=open&prompt=... still opens the global modal.
   */
  useEffect(() => {
    if (searchParams.get('chat') !== 'open') {
      return
    }

    const prompt = searchParams.get('prompt') || ''
    const shouldAutoSend =
      Boolean(prompt) && searchParams.get('send') !== '0'

    openChat({ prompt, autoSend: shouldAutoSend })

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('chat')
    nextParams.delete('prompt')
    nextParams.delete('send')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams, openChat])

  const value = useMemo(
    () => ({
      openChat,
      closeChat,
      isOpen,
    }),
    [openChat, closeChat, isOpen]
  )

  return (
    <AskSovermContext.Provider value={value}>
      {children}
      {!isOpen && (
        <FloatingCfoChatButton
          onClick={() =>
            openChat({
              suggestedPrompts: routeDefaults.suggestedPrompts,
              contextLabel: routeDefaults.contextLabel,
            })
          }
        />
      )}
      <FloatingCfoChatModal
        isOpen={isOpen}
        onClose={closeChat}
        insightId={null}
        initialDraft={draft}
        autoSendInitialDraft={autoSend}
        suggestedPrompts={suggestedPrompts ?? routeDefaults.suggestedPrompts}
        contextLabel={contextLabel ?? routeDefaults.contextLabel}
        onChatError={(message) => showToast(message, 'error')}
      />
    </AskSovermContext.Provider>
  )
}

export function useAskSoverm() {
  const context = useContext(AskSovermContext)
  if (!context) {
    throw new Error('useAskSoverm must be used within AskSovermProvider')
  }
  return context
}
