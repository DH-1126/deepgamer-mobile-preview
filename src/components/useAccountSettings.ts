import { useEffect, useState } from 'react'
import { accountSettingsRepository } from '../repository/accountSettingsRepository'

export function useAccountSettings() {
  const [settings, setSettings] = useState(() => accountSettingsRepository.getSnapshot())
  useEffect(() => accountSettingsRepository.subscribe(() => setSettings(accountSettingsRepository.getSnapshot())), [])
  return settings
}
