export const isEditableEventTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const editableContainer = target.closest('[contenteditable="true"]')
  if (editableContainer) {
    return true
  }

  const tagName = target.tagName.toLowerCase()
  if (tagName === 'textarea' || tagName === 'select') {
    return true
  }

  if (tagName === 'input') {
    const input = target as HTMLInputElement
    const type = input.type.toLowerCase()

    if (['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color'].includes(type)) {
      return false
    }

    return true
  }

  const editableRole = target.closest('[role="textbox"]')
  return Boolean(editableRole)
}
