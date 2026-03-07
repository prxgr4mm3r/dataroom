import { IconCheck, IconMinus } from '@tabler/icons-react'
import * as RadixCheckbox from '@radix-ui/react-checkbox'
import type { MouseEventHandler } from 'react'

import './selection-checkbox.css'

type SelectionCheckboxProps = {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  ariaLabel: string
  tabIndex?: number
  className?: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  onCheckedChange: (checked: boolean) => void
}

export const SelectionCheckbox = ({
  checked,
  indeterminate = false,
  disabled = false,
  ariaLabel,
  tabIndex,
  className,
  onClick,
  onCheckedChange,
}: SelectionCheckboxProps) => {
  const rootClassName = ['selection-checkbox', className].filter(Boolean).join(' ')
  const state: boolean | 'indeterminate' = indeterminate ? 'indeterminate' : checked

  return (
    <RadixCheckbox.Root
      checked={state}
      disabled={disabled}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      className={rootClassName}
      onClick={onClick}
      onCheckedChange={(state) => onCheckedChange(state === true)}
    >
      <RadixCheckbox.Indicator className="selection-checkbox__indicator">
        {indeterminate ? <IconMinus size={12} stroke={3} /> : <IconCheck size={12} stroke={3} />}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )
}
