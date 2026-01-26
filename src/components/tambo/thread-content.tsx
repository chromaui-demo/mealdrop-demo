'use client'

import styled from 'styled-components'
import {
  Message,
  MessageContent,
  MessageImages,
  MessageRenderedComponentArea,
  ReasoningInfo,
  ToolcallInfo,
  type messageVariants,
} from '@/components/tambo/message'
import { type TamboThreadMessage, useTambo } from '@tambo-ai/react'
import { type VariantProps } from 'class-variance-authority'
import * as React from 'react'

interface ThreadContentContextValue {
  messages: TamboThreadMessage[]
  isGenerating: boolean
  generationStage?: string
  variant?: VariantProps<typeof messageVariants>['variant']
}

const ThreadContentContext = React.createContext<ThreadContentContextValue | null>(null)

const useThreadContentContext = () => {
  const context = React.useContext(ThreadContentContext)
  if (!context) {
    throw new Error('ThreadContent sub-components must be used within a ThreadContent')
  }
  return context
}

export interface ThreadContentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: VariantProps<typeof messageVariants>['variant']
  children?: React.ReactNode
}

const StyledThreadContainer = styled.div`
  width: 100%;
`

const ThreadContent = React.forwardRef<HTMLDivElement, ThreadContentProps>(
  ({ children, variant, ...props }, ref) => {
    const { thread, generationStage, isIdle } = useTambo()
    const isGenerating = !isIdle

    const contextValue = React.useMemo(
      () => ({
        messages: thread?.messages ?? [],
        isGenerating,
        generationStage,
        variant,
      }),
      [thread?.messages, isGenerating, generationStage, variant]
    )

    return (
      <ThreadContentContext.Provider value={contextValue}>
        <StyledThreadContainer ref={ref} data-slot="thread-content-container" {...props}>
          {children}
        </StyledThreadContainer>
      </ThreadContentContext.Provider>
    )
  }
)
ThreadContent.displayName = 'ThreadContent'

export type ThreadContentMessagesProps = React.HTMLAttributes<HTMLDivElement>

const MessagesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const MessageWrapper = styled.div<{ $isAssistant: boolean }>`
  display: flex;
  width: 100%;
  justify-content: ${(props) => (props.$isAssistant ? 'flex-start' : 'flex-end')};
`

const MessageInner = styled.div<{ $isAssistant: boolean }>`
  display: flex;
  flex-direction: column;
  width: ${(props) => (props.$isAssistant ? '100%' : 'auto')};
  max-width: ${(props) => (props.$isAssistant ? 'none' : '48rem')};
`

const StyledMessageContent = styled(MessageContent)<{ $isAssistant: boolean }>`
  color: #1f2937;
  font-family: sans-serif;
  ${(props) =>
    !props.$isAssistant &&
    `
    background-color: #f3f4f6;
    &:hover {
      background-color: #e5e7eb;
    }
  `}
`

const ThreadContentMessages = React.forwardRef<HTMLDivElement, ThreadContentMessagesProps>(
  ({ ...props }, ref) => {
    const { messages, isGenerating, variant } = useThreadContentContext()

    const filteredMessages = messages.filter(
      (message) => message.role !== 'system' && !message.parentMessageId
    )

    return (
      <MessagesContainer ref={ref} data-slot="thread-content-messages" {...props}>
        {filteredMessages.map((message, index) => {
          const isAssistant = message.role === 'assistant'
          return (
            <div
              key={
                message.id ??
                `${message.role}-${message.createdAt ?? `${index}`}-${message.content?.toString().slice(0, 10)}`
              }
              data-slot="thread-content-item"
            >
              <Message
                role={isAssistant ? 'assistant' : 'user'}
                message={message}
                variant={variant}
                isLoading={isGenerating && index === filteredMessages.length - 1}
              >
                <MessageWrapper $isAssistant={isAssistant}>
                  <MessageInner $isAssistant={isAssistant}>
                    <ReasoningInfo />
                    <MessageImages />
                    <StyledMessageContent $isAssistant={isAssistant} />
                    <ToolcallInfo />
                    <MessageRenderedComponentArea />
                  </MessageInner>
                </MessageWrapper>
              </Message>
            </div>
          )
        })}
      </MessagesContainer>
    )
  }
)
ThreadContentMessages.displayName = 'ThreadContent.Messages'

export { ThreadContent, ThreadContentMessages }
