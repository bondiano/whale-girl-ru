declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ComponentType, ButtonHTMLAttributes, InputHTMLAttributes } from 'react'
  export const Input: ComponentType<InputHTMLAttributes<HTMLInputElement>>
  export const Button: ComponentType<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline'; size?: 'sm' }>
  export const Switch: ComponentType<{ checked: boolean; disabled?: boolean; label: string; onChange: (checked: boolean) => void }>
}
