'use client'

import styled from 'styled-components'
import { GenerationStage, useTambo } from '@tambo-ai/react'
import * as React from 'react'
import { useEffect, useRef, useState } from 'react'

export type ScrollableMessageContainerProps = React.HTMLAttributes<HTMLDivElement>

const StyledContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(107, 114, 128, 0.3);
    border-radius: 3px;
  }

  &::-webkit-scrollbar:horizontal {
    height: 4px;
  }
`

export const ScrollableMessageContainer = React.forwardRef<
  HTMLDivElement,
  ScrollableMessageContainerProps
>(({ children, ...props }, ref) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { thread } = useTambo()
  const [shouldAutoscroll, setShouldAutoscroll] = useState(true)
  const lastScrollTopRef = useRef(0)

  React.useImperativeHandle(ref, () => scrollContainerRef.current!, [])

  const messagesContent = React.useMemo(() => {
    if (!thread.messages) return null

    return thread.messages.map((message) => ({
      id: message.id,
      content: message.content,
      tool_calls: message.tool_calls,
      component: message.component,
      reasoning: message.reasoning,
      componentState: message.componentState,
    }))
  }, [thread.messages])

  const generationStage = thread?.generationStage ?? GenerationStage.IDLE

  const handleScroll = () => {
    if (!scrollContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 8

    if (scrollTop < lastScrollTopRef.current) {
      setShouldAutoscroll(false)
    } else if (isAtBottom) {
      setShouldAutoscroll(true)
    }

    lastScrollTopRef.current = scrollTop
  }

  useEffect(() => {
    if (scrollContainerRef.current && messagesContent && shouldAutoscroll) {
      const scroll = () => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'smooth',
          })
        }
      }

      if (generationStage === GenerationStage.STREAMING_RESPONSE) {
        requestAnimationFrame(scroll)
      } else {
        const timeoutId = setTimeout(scroll, 50)
        return () => clearTimeout(timeoutId)
      }
    }
  }, [messagesContent, generationStage, shouldAutoscroll])

  return (
    <StyledContainer
      ref={scrollContainerRef}
      onScroll={handleScroll}
      data-slot="scrollable-message-container"
      {...props}
    >
      {children}
    </StyledContainer>
  )
})
ScrollableMessageContainer.displayName = 'ScrollableMessageContainer'
