import { useSyncExternalStore } from 'react'
import { EMPTY_MESSAGE_STORE, messageRepository } from '../repository/messageRepository'
import { useAuthStatus } from './AuthAccess'
import { getMessageSummary } from './messageModel'
import { isLinkedDataMode } from '../runtime/dataMode'
import { recycleRepository } from '../repository/recycleRepository'

const emptySnapshot = () => EMPTY_MESSAGE_STORE
const noopSubscribe = () => () => undefined
const zeroUnread = () => 0

/** One observable source for all navigation badges, independent of route and message filters. */
export function useMessageState() {
  const authenticated = useAuthStatus()
  // Linked mode has no message API yet; never create independent demo messages there.
  const enabled = authenticated && !isLinkedDataMode
  return useSyncExternalStore(
    enabled ? messageRepository.subscribe : noopSubscribe,
    enabled ? messageRepository.getSnapshot : emptySnapshot,
    enabled ? messageRepository.getSnapshot : emptySnapshot,
  )
}

export function useMessageUnreadCount() {
  const messages = useMessageState()
  const enabled = useAuthStatus() && !isLinkedDataMode
  const recycleUnread = useSyncExternalStore(
    enabled ? recycleRepository.subscribe : noopSubscribe,
    enabled ? recycleRepository.getUnreadCount : zeroUnread,
    enabled ? recycleRepository.getUnreadCount : zeroUnread,
  )
  return getMessageSummary(messages).unreadCount + recycleUnread
}
