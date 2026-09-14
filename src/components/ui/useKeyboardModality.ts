import { useEffect, useState } from 'react'

/** Text inputs are focus-visible even after a tap; only physical keyboard input opts into the ring. */
export function useKeyboardModality() {
  const [keyboardMode, setKeyboardMode] = useState(false)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Tab' || event.key.startsWith('Arrow')) setKeyboardMode(true) }
    const onPointer = () => setKeyboardMode(false)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointer, true)
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('pointerdown', onPointer, true) }
  }, [])
  return keyboardMode
}
