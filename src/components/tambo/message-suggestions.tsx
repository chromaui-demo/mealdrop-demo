import styled, { css, keyframes } from 'styled-components'
import { MessageGenerationStage } from './message-generation-stage'
import { Tooltip, TooltipProvider } from './suggestions-tooltip'
import type { Suggestion, TamboThread } from '@tambo-ai/react'
import { GenerationStage, useTambo, useTamboSuggestions } from '@tambo-ai/react'
import { Loader2Icon } from 'lucide-react'
import * as React from 'react'
import { useEffect, useRef } from 'react'

interface MessageSuggestionsContextValue {
  suggestions: Suggestion[]
  selectedSuggestionId: string | null
  accept: (options: { suggestion: Suggestion }) => Promise<void>
  isGenerating: boolean
  error: Error | null
  thread: TamboThread
  isMac: boolean
}

const MessageSuggestionsContext = React.createContext<MessageSuggestionsContextValue | null>(null)

const useMessageSuggestionsContext = () => {
  const context = React.useContext(MessageSuggestionsContext)
  if (!context) {
    throw new Error('MessageSuggestions sub-components must be used within a MessageSuggestions')
  }
  return context
}

export interface MessageSuggestionsProps extends React.HTMLAttributes<HTMLDivElement> {
  maxSuggestions?: number
  children?: React.ReactNode
  initialSuggestions?: Suggestion[]
}

const SuggestionsContainer = styled.div`
  padding: 0 1rem 0.5rem 1rem;
`

const MessageSuggestions = React.forwardRef<HTMLDivElement, MessageSuggestionsProps>(
  ({ children, maxSuggestions = 3, initialSuggestions = [], ...props }, ref) => {
    const { thread } = useTambo()
    const {
      suggestions: generatedSuggestions,
      selectedSuggestionId,
      accept,
      generateResult: { isPending: isGenerating, error },
    } = useTamboSuggestions({ maxSuggestions })

    const suggestions = React.useMemo(() => {
      if (!thread?.messages?.length && initialSuggestions.length > 0) {
        return initialSuggestions.slice(0, maxSuggestions)
      }
      return generatedSuggestions
    }, [thread?.messages?.length, generatedSuggestions, initialSuggestions, maxSuggestions])

    const isMac = typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac')

    const lastAiMessageIdRef = useRef<string | null>(null)
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const contextValue = React.useMemo(
      () => ({
        suggestions,
        selectedSuggestionId,
        accept,
        isGenerating,
        error,
        thread,
        isMac,
      }),
      [suggestions, selectedSuggestionId, accept, isGenerating, error, thread, isMac]
    )

    const lastAiMessage = thread?.messages
      ? [...thread.messages].reverse().find((msg) => msg.role === 'assistant')
      : null

    useEffect(() => {
      if (lastAiMessage && lastAiMessage.id !== lastAiMessageIdRef.current) {
        lastAiMessageIdRef.current = lastAiMessage.id

        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
        }

        loadingTimeoutRef.current = setTimeout(() => {}, 5000)
      }

      return () => {
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
        }
      }
    }, [lastAiMessage, suggestions.length])

    useEffect(() => {
      if (!suggestions || suggestions.length === 0) return

      const handleKeyDown = (event: KeyboardEvent) => {
        const modifierPressed = isMac
          ? event.metaKey && event.altKey
          : event.ctrlKey && event.altKey

        if (modifierPressed) {
          const keyNum = Number.parseInt(event.key)
          if (!Number.isNaN(keyNum) && keyNum > 0 && keyNum <= suggestions.length) {
            event.preventDefault()
            const suggestionIndex = keyNum - 1
            void accept({ suggestion: suggestions[suggestionIndex] })
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }, [suggestions, accept, isMac])

    if (!thread?.messages?.length && initialSuggestions.length === 0) {
      return null
    }

    return (
      <MessageSuggestionsContext.Provider value={contextValue}>
        <TooltipProvider>
          <SuggestionsContainer ref={ref} data-slot="message-suggestions-container" {...props}>
            {children}
          </SuggestionsContainer>
        </TooltipProvider>
      </MessageSuggestionsContext.Provider>
    )
  }
)
MessageSuggestions.displayName = 'MessageSuggestions'

export type MessageSuggestionsStatusProps = React.HTMLAttributes<HTMLDivElement>

const StatusContainer = styled.div<{ $isEmpty: boolean }>`
  padding: ${(props) => (props.$isEmpty ? '0' : '0.5rem')};
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background-color: transparent;
  min-height: ${(props) => (props.$isEmpty ? '0' : 'auto')};
  margin-bottom: ${(props) => (props.$isEmpty ? '0' : 'auto')};
`

const ErrorContainer = styled.div`
  padding: 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background-color: #fef2f2;
  color: #ef4444;
`

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
`

const SpinningLoader = styled(Loader2Icon)`
  height: 1rem;
  width: 1rem;
  animation: ${spin} 1s linear infinite;
`

const MessageSuggestionsStatus = React.forwardRef<HTMLDivElement, MessageSuggestionsStatusProps>(
  ({ ...props }, ref) => {
    const { error, isGenerating, thread } = useMessageSuggestionsContext()

    const isEmpty =
      !error &&
      !isGenerating &&
      (!thread?.generationStage || thread.generationStage === GenerationStage.COMPLETE)

    return (
      <StatusContainer
        ref={ref}
        $isEmpty={isEmpty}
        data-slot="message-suggestions-status"
        {...props}
      >
        {error && (
          <ErrorContainer>
            <p>{error.message}</p>
          </ErrorContainer>
        )}

        <div>
          <GenerationStageContent
            generationStage={thread?.generationStage}
            isGenerating={isGenerating}
          />
        </div>
      </StatusContainer>
    )
  }
)
MessageSuggestionsStatus.displayName = 'MessageSuggestions.Status'

function GenerationStageContent({
  generationStage,
  isGenerating,
}: {
  generationStage?: string
  isGenerating: boolean
}) {
  if (generationStage && generationStage !== GenerationStage.COMPLETE) {
    return <MessageGenerationStage />
  }
  if (isGenerating) {
    return (
      <LoadingContainer>
        <SpinningLoader />
        <p>Generating suggestions...</p>
      </LoadingContainer>
    )
  }
  return null
}

export type MessageSuggestionsListProps = React.HTMLAttributes<HTMLDivElement>

const SuggestionsListContainer = styled.div<{ $isGenerating: boolean }>`
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  border-radius: 0.375rem;
  background-color: transparent;
  min-height: 2.5rem;
  opacity: ${(props) => (props.$isGenerating ? 0.7 : 1)};
`

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`

const SuggestionButton = styled.button<{ $isGenerating: boolean; $isSelected: boolean }>`
  padding: 0.5rem 0.625rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  transition:
    background-color 150ms,
    color 150ms;
  border: 1px solid #e5e7eb;
  cursor: ${(props) => (props.$isGenerating ? 'not-allowed' : 'pointer')};

  ${(props) => {
    if (props.$isGenerating) {
      return css`
        background-color: rgba(0, 0, 0, 0.05);
        color: #6b7280;
      `
    }
    if (props.$isSelected) {
      return css`
        background-color: #f3f4f6;
        color: #1f2937;
      `
    }
    return css`
      background-color: #ffffff;
      &:hover {
        background-color: #f3f4f6;
      }
    `
  }}
`

const SuggestionTitle = styled.span`
  font-weight: 500;
`

const PlaceholderButton = styled.div`
  padding: 0.5rem 0.625rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  border: 1px solid #e5e7eb;
  background-color: rgba(0, 0, 0, 0.05);
  color: transparent;
  animation: ${pulse} 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
`

const MessageSuggestionsList = React.forwardRef<HTMLDivElement, MessageSuggestionsListProps>(
  ({ ...props }, ref) => {
    const { suggestions, selectedSuggestionId, accept, isGenerating, isMac } =
      useMessageSuggestionsContext()

    const modKey = isMac ? '⌘' : 'Ctrl'
    const altKey = isMac ? '⌥' : 'Alt'

    const placeholders = Array.from({ length: 3 }).fill(null)

    return (
      <SuggestionsListContainer
        ref={ref}
        $isGenerating={isGenerating}
        data-slot="message-suggestions-list"
        {...props}
      >
        {suggestions.length > 0
          ? suggestions.map((suggestion, index) => (
              <Tooltip
                key={suggestion.id}
                content={
                  <span suppressHydrationWarning>
                    {modKey}+{altKey}+{index + 1}
                  </span>
                }
                side="top"
              >
                <SuggestionButton
                  $isGenerating={isGenerating}
                  $isSelected={selectedSuggestionId === suggestion.id}
                  onClick={async () => !isGenerating && (await accept({ suggestion }))}
                  disabled={isGenerating}
                  data-suggestion-id={suggestion.id}
                  data-suggestion-index={index}
                >
                  <SuggestionTitle>{suggestion.title}</SuggestionTitle>
                </SuggestionButton>
              </Tooltip>
            ))
          : placeholders.map((_, index) => (
              <PlaceholderButton key={`placeholder-${index}`} data-placeholder-index={index}>
                <span style={{ visibility: 'hidden' }}>Placeholder</span>
              </PlaceholderButton>
            ))}
      </SuggestionsListContainer>
    )
  }
)
MessageSuggestionsList.displayName = 'MessageSuggestions.List'

export { MessageSuggestions, MessageSuggestionsList, MessageSuggestionsStatus }

export {
  TooltipTrigger,
  Tooltip,
  TooltipContent,
  TooltipRoot,
  TooltipProvider,
} from './suggestions-tooltip'
