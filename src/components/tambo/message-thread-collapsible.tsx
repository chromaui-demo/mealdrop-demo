'use client'

import styled from 'styled-components'
import type { messageVariants } from '@/components/tambo/message'
import {
  MessageInput,
  MessageInputError,
  MessageInputFileButton,
  MessageInputMcpPromptButton,
  MessageInputMcpResourceButton,
  MessageInputSubmitButton,
  MessageInputTextarea,
  MessageInputToolbar,
} from '@/components/tambo/message-input'
import {
  MessageSuggestions,
  MessageSuggestionsList,
  MessageSuggestionsStatus,
} from '@/components/tambo/message-suggestions'
import { ScrollableMessageContainer } from '@/components/tambo/scrollable-message-container'
import { ThreadContent, ThreadContentMessages } from '@/components/tambo/thread-content'
import { ThreadDropdown } from '@/components/tambo/thread-dropdown'
import { type Suggestion } from '@tambo-ai/react'
import { type VariantProps } from 'class-variance-authority'
import { XIcon } from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as React from 'react'

export interface MessageThreadCollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean
  variant?: VariantProps<typeof messageVariants>['variant']
  height?: string
  maxHeight?: string
}

const useCollapsibleState = (defaultOpen = false) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)
  const isMac = typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac')
  const shortcutText = isMac ? '⌘K' : 'Ctrl+K'

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return { isOpen, setIsOpen, shortcutText }
}

interface CollapsibleContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

const StyledCollapsibleRoot = styled(Collapsible.Root)`
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 999;
  width: 100%;
  max-width: 24rem;
  border-radius: 0.5rem;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  transition: all 300ms ease-in-out;

  @media (min-width: 640px) {
    max-width: 28rem;
  }

  @media (min-width: 768px) {
    max-width: 32rem;
  }
`

const CollapsibleContainer = React.forwardRef<HTMLDivElement, CollapsibleContainerProps>(
  ({ isOpen, onOpenChange, children, ...props }, ref) => (
    <StyledCollapsibleRoot ref={ref} open={isOpen} onOpenChange={onOpenChange} {...props}>
      {children}
    </StyledCollapsibleRoot>
  )
)
CollapsibleContainer.displayName = 'CollapsibleContainer'

interface CollapsibleTriggerProps {
  isOpen: boolean
  shortcutText: string
  onClose: () => void
  onThreadChange: () => void
  config: {
    labels: {
      openState: string
      closedState: string
    }
  }
}

const TriggerButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 150ms;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
`

const ShortcutText = styled.span`
  font-size: 0.75rem;
  color: #6b7280;
  padding-left: 2rem;
`

const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 1rem;
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const CloseButton = styled.button`
  padding: 0.25rem;
  border-radius: 9999px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 150ms;

  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
`

const StyledXIcon = styled(XIcon)`
  height: 1rem;
  width: 1rem;
`

const CollapsibleTrigger = ({
  isOpen,
  shortcutText,
  onClose,
  onThreadChange,
  config,
}: CollapsibleTriggerProps) => (
  <>
    {!isOpen && (
      <Collapsible.Trigger asChild>
        <TriggerButton aria-expanded={isOpen} aria-controls="message-thread-content">
          <span>{config.labels.closedState}</span>
          <ShortcutText suppressHydrationWarning>{`(${shortcutText})`}</ShortcutText>
        </TriggerButton>
      </Collapsible.Trigger>
    )}
    {isOpen && (
      <HeaderContainer>
        <HeaderLeft>
          <span>{config.labels.openState}</span>
          <ThreadDropdown onThreadChange={onThreadChange} />
        </HeaderLeft>
        <CloseButton
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          aria-label="Close"
        >
          <StyledXIcon />
        </CloseButton>
      </HeaderContainer>
    )}
  </>
)
CollapsibleTrigger.displayName = 'CollapsibleTrigger'

const ContentWrapper = styled.div<{ $height?: string }>`
  display: flex;
  flex-direction: column;
  height: ${(props) => props.$height || '80vh'};
`

const InputWrapper = styled.div`
  padding: 1rem;
`

export const MessageThreadCollapsible = React.forwardRef<
  HTMLDivElement,
  MessageThreadCollapsibleProps
>(({ defaultOpen = false, variant, height, maxHeight, ...props }, ref) => {
  const { isOpen, setIsOpen, shortcutText } = useCollapsibleState(defaultOpen)

  const effectiveHeight = height ?? maxHeight

  const handleThreadChange = React.useCallback(() => {
    setIsOpen(true)
  }, [setIsOpen])

  const THREAD_CONFIG = {
    labels: {
      openState: 'Conversations',
      closedState: 'Start chatting with mealdrop',
    },
  }

  const defaultSuggestions: Suggestion[] = [
    {
      id: 'suggestion-1',
      title: 'Get started',
      detailedSuggestion: 'What can you help me with?',
      messageId: 'welcome-query',
    },
    {
      id: 'suggestion-2',
      title: 'Learn more',
      detailedSuggestion: 'Tell me about your capabilities.',
      messageId: 'capabilities-query',
    },
    {
      id: 'suggestion-3',
      title: 'Examples',
      detailedSuggestion: 'Show me some example queries I can try.',
      messageId: 'examples-query',
    },
  ]

  return (
    <CollapsibleContainer ref={ref} isOpen={isOpen} onOpenChange={setIsOpen} {...props}>
      <CollapsibleTrigger
        isOpen={isOpen}
        shortcutText={shortcutText}
        onClose={() => setIsOpen(false)}
        onThreadChange={handleThreadChange}
        config={THREAD_CONFIG}
      />
      <Collapsible.Content>
        <ContentWrapper $height={effectiveHeight}>
          <ScrollableMessageContainer>
            <ThreadContent variant={variant}>
              <ThreadContentMessages />
            </ThreadContent>
          </ScrollableMessageContainer>

          <MessageSuggestions>
            <MessageSuggestionsStatus />
          </MessageSuggestions>

          <InputWrapper>
            <MessageInput>
              <MessageInputTextarea placeholder="Type your message or paste images..." />
              <MessageInputToolbar>
                <MessageInputFileButton />
                <MessageInputMcpPromptButton />
                <MessageInputMcpResourceButton />
                <MessageInputSubmitButton />
              </MessageInputToolbar>
              <MessageInputError />
            </MessageInput>
          </InputWrapper>

          <MessageSuggestions initialSuggestions={defaultSuggestions}>
            <MessageSuggestionsList />
          </MessageSuggestions>
        </ContentWrapper>
      </Collapsible.Content>
    </CollapsibleContainer>
  )
})
MessageThreadCollapsible.displayName = 'MessageThreadCollapsible'
