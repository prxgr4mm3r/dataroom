import { IconCheck } from '@tabler/icons-react'
import * as RadixCheckbox from '@radix-ui/react-checkbox'
import type { MouseEventHandler } from 'react'

import './selection-checkbox.css'

type SelectionCheckboxProps = {
  checked: boolean
  disabled?: boolean
  ariaLabel: string
  tabIndex?: number
  className?: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  onCheckedChange: (checked: boolean) => void
}

export const SelectionCheckbox = ({
  checked,
  disabled = false,
  ariaLabel,
  tabIndex,
  className,
  onClick,
  onCheckedChange,
}: SelectionCheckboxProps) => {
  const rootClassName = ['selection-checkbox', className].filter(Boolean).join(' ')

  return (
    <RadixCheckbox.Root
      checked={checked}
      disabled={disabled}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      className={rootClassName}
      onClick={onClick}
      onCheckedChange={(state) => onCheckedChange(state === true)}
    >
      <RadixCheckbox.Indicator className="selection-checkbox__indicator">
        <IconCheck size={12} stroke={3} />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )
}

