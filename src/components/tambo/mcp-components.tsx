import styled from 'styled-components'
import { Tooltip, TooltipProvider } from '@/components/tambo/message-suggestions'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  useTamboMcpPrompt,
  useTamboMcpPromptList,
  useTamboMcpResourceList,
} from '@tambo-ai/react/mcp'
import { AtSign, FileText, Search } from 'lucide-react'
import * as React from 'react'

export interface McpPromptButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onInsertText: (text: string) => void
  value: string
  className?: string
}

const ActionButton = styled.button`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  color: #1f2937;
  transition: background-color 150ms;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    background-color: #f3f4f6;
  }

  &:disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  &:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px #ffffff,
      0 0 0 4px #3b82f6;
  }
`

const DropdownContent = styled(DropdownMenu.Content)`
  z-index: 50;
  min-width: 200px;
  max-width: 300px;
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
  align-items: flex-start;
  flex-direction: column;
  border-radius: 0.125rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
  outline: none;

  &:hover,
  &:focus {
    background-color: #f3f4f6;
  }

  &[data-disabled] {
    pointer-events: none;
    opacity: 0.5;
  }
`

const DisabledItem = styled(DropdownMenu.Item)`
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
`

const PromptName = styled.span`
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
`

const PromptDescription = styled.span`
  font-size: 0.75rem;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
`

export const McpPromptButton = React.forwardRef<HTMLButtonElement, McpPromptButtonProps>(
  ({ onInsertText, value, ...props }, ref) => {
    const { data: promptList, isLoading } = useTamboMcpPromptList()
    const [selectedPromptName, setSelectedPromptName] = React.useState<string | null>(null)
    const { data: promptData } = useTamboMcpPrompt(selectedPromptName ?? '')

    React.useEffect(() => {
      if (promptData && selectedPromptName) {
        const promptText = promptData.messages
          .map((msg) => {
            if (msg.content.type === 'text') {
              return msg.content.text
            }
            return ''
          })
          .filter(Boolean)
          .join('\n')

        const newValue = value ? `${value}\n\n${promptText}` : promptText
        onInsertText(newValue)
        setSelectedPromptName(null)
      }
    }, [promptData, selectedPromptName, onInsertText, value])

    if (!promptList || promptList.length === 0) {
      return null
    }

    return (
      <TooltipProvider>
        <Tooltip content="Insert MCP Prompt" side="top">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <ActionButton
                ref={ref}
                type="button"
                aria-label="Insert MCP Prompt"
                data-slot="mcp-prompt-button"
                {...props}
              >
                <FileText style={{ width: '1rem', height: '1rem' }} />
              </ActionButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownContent side="top" align="start" sideOffset={5}>
                <PromptListContent
                  isLoading={isLoading}
                  promptList={promptList}
                  onSelectPrompt={setSelectedPromptName}
                />
              </DropdownContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </Tooltip>
      </TooltipProvider>
    )
  }
)
McpPromptButton.displayName = 'McpPromptButton'

function PromptListContent({
  isLoading,
  promptList,
  onSelectPrompt,
}: {
  isLoading: boolean
  promptList:
    | {
        server: { url: string }
        prompt: { name: string; description?: string }
      }[]
    | undefined
  onSelectPrompt: (name: string) => void
}) {
  if (isLoading) {
    return <DisabledItem disabled>Loading prompts...</DisabledItem>
  }
  if (!promptList || promptList.length === 0) {
    return <DisabledItem disabled>No prompts available</DisabledItem>
  }
  return (
    <>
      {promptList.map((promptEntry) => (
        <MenuItem
          key={`${promptEntry.server.url}-${promptEntry.prompt.name}`}
          onSelect={() => {
            onSelectPrompt(promptEntry.prompt.name)
          }}
        >
          <PromptName>{promptEntry.prompt.name}</PromptName>
          {promptEntry.prompt.description && (
            <PromptDescription>{promptEntry.prompt.description}</PromptDescription>
          )}
        </MenuItem>
      ))}
    </>
  )
}

interface ResourceComboboxProps {
  setIsOpen: (open: boolean) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  filteredResources: ReturnType<typeof useTamboMcpResourceList>['data']
  isLoading: boolean
  onSelectResource: (id: string, label: string) => void
}

const ResourceDropdownContent = styled(DropdownMenu.Content)`
  z-index: 50;
  width: 400px;
  max-height: 400px;
  overflow: hidden;
  border-radius: 0.375rem;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
`

const SearchContainer = styled.div`
  position: sticky;
  top: 0;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  padding: 0.5rem;
  z-index: 10;
`

const SearchInputWrapper = styled.div`
  position: relative;
`

const SearchIconWrapper = styled.div`
  position: absolute;
  left: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: #6b7280;
`

const SearchInput = styled.input`
  width: 100%;
  padding: 0.375rem 0.75rem 0.375rem 2rem;
  font-size: 0.875rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px #3b82f6;
    border-color: transparent;
  }
`

const ResourceListContainer = styled.div`
  overflow-y: auto;
  max-height: 320px;
  padding: 0.25rem;
`

const EmptyMessage = styled.div`
  padding: 0.5rem 2rem;
  text-align: center;
  font-size: 0.875rem;
  color: #6b7280;
`

const ResourceItem = styled(DropdownMenu.Item)`
  position: relative;
  display: flex;
  cursor: pointer;
  user-select: none;
  align-items: flex-start;
  flex-direction: column;
  border-radius: 0.125rem;
  padding: 0.5rem;
  font-size: 0.875rem;
  outline: none;

  &:hover,
  &:focus {
    background-color: #f3f4f6;
  }

  &[data-disabled] {
    pointer-events: none;
    opacity: 0.5;
  }
`

const ResourceItemContent = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  gap: 0.5rem;
`

const ResourceItemMain = styled.div`
  flex: 1;
  min-width: 0;
`

const ResourceName = styled.div`
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ResourceUri = styled.div`
  font-size: 0.75rem;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
`

const ResourceDescription = styled.div`
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.125rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const ResourceCombobox: React.FC<ResourceComboboxProps> = ({
  searchQuery,
  setSearchQuery,
  filteredResources,
  isLoading,
  onSelectResource,
  setIsOpen,
}) => {
  return (
    <DropdownMenu.Portal>
      <ResourceDropdownContent
        side="top"
        align="start"
        sideOffset={5}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
        }}
      >
        <SearchContainer>
          <SearchInputWrapper>
            <SearchIconWrapper>
              <Search style={{ width: '1rem', height: '1rem' }} />
            </SearchIconWrapper>
            <SearchInput
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') {
                  setIsOpen(false)
                }
              }}
            />
          </SearchInputWrapper>
        </SearchContainer>

        <ResourceListContainer>
          <ResourceListContent
            isLoading={isLoading}
            filteredResources={filteredResources}
            searchQuery={searchQuery}
            onSelectResource={onSelectResource}
          />
        </ResourceListContainer>
      </ResourceDropdownContent>
    </DropdownMenu.Portal>
  )
}

function ResourceListContent({
  isLoading,
  filteredResources,
  searchQuery,
  onSelectResource,
}: {
  isLoading: boolean
  filteredResources: ReturnType<typeof useTamboMcpResourceList>['data']
  searchQuery: string
  onSelectResource: (id: string, label: string) => void
}) {
  if (isLoading) {
    return <EmptyMessage>Loading resources...</EmptyMessage>
  }
  if (!filteredResources || filteredResources.length === 0) {
    return (
      <EmptyMessage>
        {searchQuery ? `No resources matching "${searchQuery}"` : 'No resources available'}
      </EmptyMessage>
    )
  }
  return (
    <>
      {filteredResources.map((resourceEntry) => (
        <ResourceItem
          key={resourceEntry.resource.uri}
          onSelect={() => {
            onSelectResource(
              resourceEntry.resource.uri,
              resourceEntry.resource.name || resourceEntry.resource.uri
            )
          }}
        >
          <ResourceItemContent>
            <ResourceItemMain>
              <ResourceName>{resourceEntry.resource.name ?? 'Unnamed Resource'}</ResourceName>
              <ResourceUri>{resourceEntry.resource.uri}</ResourceUri>
              {resourceEntry.resource.description && (
                <ResourceDescription>{resourceEntry.resource.description}</ResourceDescription>
              )}
            </ResourceItemMain>
          </ResourceItemContent>
        </ResourceItem>
      ))}
    </>
  )
}

export interface McpResourceButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onInsertResource: (id: string, label: string) => void
  value: string
  className?: string
}

export const McpResourceButton = React.forwardRef<HTMLButtonElement, McpResourceButtonProps>(
  ({ onInsertResource, ...props }, ref) => {
    const { data: resourceList, isLoading } = useTamboMcpResourceList()
    const [isOpen, setIsOpen] = React.useState(false)
    const [searchQuery, setSearchQuery] = React.useState('')

    const filteredResources = React.useMemo(() => {
      if (!resourceList) return []
      if (!searchQuery) return resourceList

      const query = searchQuery.toLowerCase()
      return resourceList.filter((entry) => {
        const uri = entry.resource.uri.toLowerCase()
        const name = entry.resource.name?.toLowerCase() ?? ''
        const description = entry.resource.description?.toLowerCase() ?? ''
        return [uri.includes(query), name.includes(query), description.includes(query)].some(
          Boolean
        )
      })
    }, [resourceList, searchQuery])

    const handleSelectResource = (id: string, label: string) => {
      onInsertResource(id, label)
      setIsOpen(false)
      setSearchQuery('')
    }

    if (!resourceList || resourceList.length === 0) {
      return null
    }

    return (
      <TooltipProvider>
        <Tooltip content="Insert MCP Resource" side="top">
          <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenu.Trigger asChild>
              <ActionButton
                ref={ref}
                type="button"
                aria-label="Insert MCP Resource"
                data-slot="mcp-resource-button"
                {...props}
              >
                <AtSign style={{ width: '1rem', height: '1rem' }} />
              </ActionButton>
            </DropdownMenu.Trigger>
            <ResourceCombobox
              setIsOpen={setIsOpen}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filteredResources={filteredResources}
              isLoading={isLoading}
              onSelectResource={handleSelectResource}
            />
          </DropdownMenu.Root>
        </Tooltip>
      </TooltipProvider>
    )
  }
)
McpResourceButton.displayName = 'McpResourceButton'
