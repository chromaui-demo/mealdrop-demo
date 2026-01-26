'use client'

import styled from 'styled-components'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'

const TooltipProvider = TooltipPrimitive.Provider

const TooltipRoot = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const StyledTooltipContent = styled(TooltipPrimitive.Content)`
  z-index: 50;
  overflow: hidden;
  border-radius: 0.375rem;
  background-color: #1f2937;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  color: #ffffff;
`

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <StyledTooltipContent ref={ref} sideOffset={sideOffset} {...props} />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

interface TooltipProps {
  children: React.ReactNode
  content?: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

const Tooltip = React.forwardRef<HTMLButtonElement, TooltipProps>(
  ({ children, content, side = 'top' }, ref) => {
    if (content) {
      return (
        <TooltipRoot>
          <TooltipTrigger ref={ref} asChild>
            {children}
          </TooltipTrigger>
          <TooltipContent side={side}>{content}</TooltipContent>
        </TooltipRoot>
      )
    }
    return <TooltipRoot>{children}</TooltipRoot>
  }
)
Tooltip.displayName = 'Tooltip'

export { Tooltip, TooltipRoot, TooltipTrigger, TooltipContent, TooltipProvider }
