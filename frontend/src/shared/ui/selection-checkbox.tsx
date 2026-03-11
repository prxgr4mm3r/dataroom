import { IconCheck, IconMinus } from '@tabler/icons-react'
import * as RadixCheckbox from '@radix-ui/react-checkbox'
import type { MouseEventHandler } from 'react'

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
const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')
const CHECKBOX_ROOT_CLASS_NAME =
  "m-0 box-border flex h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none items-center justify-center self-center rounded-[5px] border-[1.5px] border-solid border-[var(--checkbox-border)] bg-[var(--checkbox-bg)] p-0 leading-[0] text-[var(--checkbox-bg)] transition-[border-color,background-color,box-shadow] duration-[140ms] ease-[ease] hover:border-[var(--checkbox-hover-border)] hover:bg-[var(--checkbox-hover-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] data-[state=checked]:border-[var(--checkbox-checked)] data-[state=checked]:bg-[var(--checkbox-checked)] data-[state=indeterminate]:border-[var(--checkbox-checked)] data-[state=indeterminate]:bg-[var(--checkbox-checked)] data-[state=checked]:hover:border-[var(--checkbox-checked-hover)] data-[state=checked]:hover:bg-[var(--checkbox-checked-hover)] data-[state=indeterminate]:hover:border-[var(--checkbox-checked-hover)] data-[state=indeterminate]:hover:bg-[var(--checkbox-checked-hover)] data-[disabled]:cursor-not-allowed data-[disabled]:border-[var(--checkbox-disabled-border)] data-[disabled]:bg-[var(--checkbox-disabled-bg)] data-[disabled]:text-[var(--checkbox-disabled-color)]"
const CHECKBOX_INDICATOR_CLASS_NAME = 'inline-flex items-center justify-center leading-[0] text-current [&>svg]:h-3 [&>svg]:w-3'

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
  const rootClassName = cx(CHECKBOX_ROOT_CLASS_NAME, className)
  const state: boolean | 'indeterminate' = indeterminate ? 'indeterminate' : checked

  return (
    <RadixCheckbox.Root
      checked={state}
      disabled={disabled}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      className={rootClassName}
      onMouseDown={(event) => {
        // Keep click selection from leaving a persistent focus ring on the last clicked checkbox.
        event.preventDefault()
      }}
      onClick={onClick}
      onCheckedChange={(state) => onCheckedChange(state === true)}
    >
      <RadixCheckbox.Indicator className={CHECKBOX_INDICATOR_CLASS_NAME}>
        {indeterminate ? <IconMinus size={12} stroke={3} /> : <IconCheck size={12} stroke={3} />}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )
}
