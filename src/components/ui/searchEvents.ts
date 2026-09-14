type SearchKeyEvent = {
  key: string
  defaultPrevented: boolean
  nativeEvent: { isComposing?: boolean; keyCode?: number }
  preventDefault: () => void
}

/** Own Enter submission so enclosing forms cannot submit twice or commit IME input. */
export function submitSearchOnEnter(event: SearchKeyEvent, composing: boolean, onSearch?: () => void) {
  if (event.key !== 'Enter' || event.defaultPrevented || !onSearch) return
  event.preventDefault()
  if (composing || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
  onSearch()
}
