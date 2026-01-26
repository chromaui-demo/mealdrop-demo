'use client'

import styled from 'styled-components'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useTamboThread, useTamboThreadList } from '@tambo-ai/react'
import { ChevronDownIcon, PlusIcon } from 'lucide-react'
import * as React from 'react'
import { useCallback } from 'react'

export interface ThreadDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  onThreadChange?: () => void
}

const DropdownContainer = styled.div`
  position: relative;
`

const TriggerButton = styled.div`
  border-radius: 0.375rem;
  padding: 0 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  cursor: pointer;
  transition: background-color 150ms;

  &:hover {
    background-color: #f3f4f6;
  }
`

const StyledChevron = styled(ChevronDownIcon)`
  height: 1rem;
  width: 1rem;
`

const StyledPlusIcon = styled(PlusIcon)`
  margin-right: 0.5rem;
  height: 1rem;
  width: 1rem;
`

const DropdownContent = styled(DropdownMenu.Content)`
  z-index: 50;
  min-width: 200px;
  overflow: hidden;
  border-radius: 0.375rem;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  padding: 0.25rem;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
`

const MenuItem = styled(DropdownMenu.Item)`
  position: relative;
  display: flex;
  cursor: pointer;
  user-select: none;
  align-items: center;
  border-radius: 0.125rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
  outline: none;

  &:hover {
    background-color: #f3f4f6;
  }

  &[data-disabled] {
    pointer-events: none;
    opacity: 0.5;
  }
`

const MenuItemContent = styled.div`
  display: flex;
  align-items: center;
`

const ShortcutText = styled.span`
  margin-left: auto;
  font-size: 0.75rem;
  color: #6b7280;
`

const Separator = styled(DropdownMenu.Separator)`
  margin: 0.25rem 0;
  height: 1px;
  background-color: #e5e7eb;
`

const ThreadName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
`

const DisabledItem = styled(DropdownMenu.Item)`
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
`

const ErrorItem = styled(DropdownMenu.Item)`
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
  color: #ef4444;
`

export const ThreadDropdown = React.forwardRef<HTMLDivElement, ThreadDropdownProps>(
  ({ onThreadChange, ...props }, ref) => {
    const { data: threads, isLoading, error, refetch } = useTamboThreadList()
    const { switchCurrentThread, startNewThread } = useTamboThread()
    const isMac = typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac')
    const modKey = isMac ? '⌥' : 'Alt'

    const handleNewThread = useCallback(
      async (e?: React.MouseEvent) => {
        if (e) {
          e.stopPropagation()
        }

        try {
          await startNewThread()
          await refetch()
          onThreadChange?.()
        } catch (error) {
          console.error('Failed to create new thread:', error)
        }
      },
      [onThreadChange, startNewThread, refetch]
    )

    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.altKey && event.shiftKey && event.key === 'n') {
          event.preventDefault()
          void handleNewThread()
        }
      }

      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }, [handleNewThread])

    const handleSwitchThread = async (threadId: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation()
      }

      try {
        switchCurrentThread(threadId)
        onThreadChange?.()
      } catch (error) {
        console.error('Failed to switch thread:', error)
      }
    }

    return (
      <DropdownContainer ref={ref} {...props}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <TriggerButton role="button" tabIndex={0} aria-label="Thread History">
              <StyledChevron />
            </TriggerButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownContent side="right" align="start" sideOffset={5}>
              <MenuItem
                onSelect={(e: Event) => {
                  e.preventDefault()
                  void handleNewThread()
                }}
              >
                <MenuItemContent>
                  <StyledPlusIcon />
                  <span>New Thread</span>
                </MenuItemContent>
                <ShortcutText suppressHydrationWarning>{modKey}+⇧+N</ShortcutText>
              </MenuItem>

              <Separator />

              <ThreadListContent
                isLoading={isLoading}
                error={error}
                threads={threads}
                onSwitchThread={handleSwitchThread}
              />
            </DropdownContent>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </DropdownContainer>
    )
  }
)
ThreadDropdown.displayName = 'ThreadDropdown'

function ThreadListContent({
  isLoading,
  error,
  threads,
  onSwitchThread,
}: {
  isLoading: boolean
  error: Error | null
  threads: { items: { id: string }[] } | null | undefined
  onSwitchThread: (threadId: string) => void
}) {
  if (isLoading) {
    return <DisabledItem disabled>Loading threads...</DisabledItem>
  }
  if (error) {
    return <ErrorItem disabled>Error loading threads</ErrorItem>
  }
  if (threads?.items.length === 0) {
    return <DisabledItem disabled>No previous threads</DisabledItem>
  }
  return (
    <>
      {threads?.items.map((thread) => (
        <MenuItem
          key={thread.id}
          onSelect={(e: Event) => {
            e.preventDefault()
            void onSwitchThread(thread.id)
          }}
        >
          <ThreadName>{`Thread ${thread.id.slice(0, 8)}`}</ThreadName>
        </MenuItem>
      ))}
    </>
  )
}
