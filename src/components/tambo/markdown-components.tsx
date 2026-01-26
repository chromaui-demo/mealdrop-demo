import styled from 'styled-components'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import { Check, Copy, ExternalLink, X } from 'lucide-react'
import * as React from 'react'

const looksLikeCode = (text: string): boolean => {
  const codeIndicators = [
    /^import\s+/m,
    /^function\s+/m,
    /^class\s+/m,
    /^const\s+/m,
    /^let\s+/m,
    /^var\s+/m,
    /[{}[\]();]/,
    /^\s*\/\//m,
    /^\s*\/\*/m,
    /=>/,
    /^export\s+/m,
  ]
  return codeIndicators.some((pattern) => pattern.test(text))
}

const MentionSpan = styled.span`
  display: inline-flex;
  align-items: center;
  border-radius: 0.375rem;
  background-color: #f3f4f6;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  cursor: default;
`

function ResourceMention({ name, uri }: { name: string; uri: string }) {
  return (
    <MentionSpan className="mention resource" data-resource-uri={uri} title={uri}>
      @{name}
    </MentionSpan>
  )
}

const CodeBlockContainer = styled.div`
  position: relative;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  background-color: #f3f4f6;
  max-width: 80ch;
  font-size: 0.875rem;
  margin: 1rem 0;
`

const CodeHeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-radius: 0.375rem 0.375rem 0 0;
  background-color: #f9fafb;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
`

const LanguageLabel = styled.span`
  text-transform: lowercase;
  color: #6b7280;
`

const CopyButton = styled.button`
  padding: 0.25rem;
  border-radius: 0.375rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 150ms;

  &:hover {
    background-color: #e5e7eb;
  }
`

const CodeContentWrapper = styled.div`
  overflow-x: auto;
  border-radius: 0 0 0.375rem 0.375rem;
  background-color: #ffffff;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(107, 114, 128, 0.3);
    border-radius: 0.375rem;
  }

  &::-webkit-scrollbar:horizontal {
    height: 4px;
  }
`

const PreBlock = styled.pre`
  padding: 1rem;
  white-space: pre;
  margin: 0;
`

const InlineCode = styled.code`
  background-color: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
`

const Paragraph = styled.p`
  margin: 0;
`

const H1 = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 1.5rem;
`

const H2 = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  margin-top: 1.25rem;
`

const H3 = styled.h3`
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  margin-top: 1rem;
`

const H4 = styled.h4`
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  margin-top: 0.75rem;
`

const UL = styled.ul`
  list-style-type: disc;
  padding-left: 1.25rem;
`

const OL = styled.ol`
  list-style-type: decimal;
  padding-left: 1.25rem;
`

const LI = styled.li`
  line-height: 1.5;
`

const Blockquote = styled.blockquote`
  border-left: 4px solid #e5e7eb;
  padding-left: 1rem;
  font-style: italic;
  margin: 1rem 0;
`

const StyledLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: #1f2937;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-color: #6b7280;
  transition:
    color 150ms,
    text-decoration-color 150ms;

  &:hover {
    color: #111827;
    text-decoration-color: #111827;
  }
`

const LinkIcon = styled(ExternalLink)`
  width: 0.75rem;
  height: 0.75rem;
`

const HR = styled.hr`
  margin: 1rem 0;
  border-color: #e5e7eb;
`

const TableWrapper = styled.div`
  overflow-x: auto;
  margin: 1rem 0;
`

const Table = styled.table`
  min-width: 100%;
  border: 1px solid #e5e7eb;
`

const TH = styled.th`
  border: 1px solid #e5e7eb;
  padding: 0.5rem 1rem;
  background-color: #f3f4f6;
  font-weight: 600;
`

const TD = styled.td`
  border: 1px solid #e5e7eb;
  padding: 0.5rem 1rem;
`

const CodeHeader = ({ language, code }: { language?: string; code?: string }) => {
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const copyToClipboard = async () => {
    if (!code) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setError(false)
    } catch (error_) {
      console.error('Failed to copy code to clipboard:', error_)
      setError(true)
    }
    timeoutRef.current = setTimeout(() => setError(false), 2000)
  }

  const Icon = React.useMemo(() => {
    if (error) {
      return <X style={{ width: '1rem', height: '1rem', color: '#ef4444' }} />
    }
    if (copied) {
      return <Check style={{ width: '1rem', height: '1rem', color: '#22c55e' }} />
    }
    return <Copy style={{ width: '1rem', height: '1rem' }} />
  }, [copied, error])

  return (
    <CodeHeaderContainer>
      <LanguageLabel>{language}</LanguageLabel>
      <CopyButton onClick={copyToClipboard} title={error ? 'Failed to copy' : 'Copy code'}>
        {Icon}
      </CopyButton>
    </CodeHeaderContainer>
  )
}

export const createMarkdownComponents = (): Record<string, React.ComponentType<any>> => ({
  code: function Code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? '')
    const content = String(children).replace(/\n$/, '')
    const deferredContent = React.useDeferredValue(content)

    const highlighted = React.useMemo(() => {
      if (!match || !looksLikeCode(deferredContent)) return null
      try {
        return hljs.highlight(deferredContent, { language: match[1] }).value
      } catch {
        return deferredContent
      }
    }, [deferredContent, match])

    if (match && looksLikeCode(content)) {
      return (
        <CodeBlockContainer>
          <CodeHeader language={match[1]} code={content} />
          <CodeContentWrapper>
            <PreBlock>
              <code
                className={className}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(highlighted ?? content),
                }}
              />
            </PreBlock>
          </CodeContentWrapper>
        </CodeBlockContainer>
      )
    }

    return <InlineCode {...props}>{children}</InlineCode>
  },

  p: ({ children }) => <Paragraph>{children}</Paragraph>,

  h1: ({ children }) => <H1>{children}</H1>,

  h2: ({ children }) => <H2>{children}</H2>,

  h3: ({ children }) => <H3>{children}</H3>,

  h4: ({ children }) => <H4>{children}</H4>,

  ul: ({ children }) => <UL>{children}</UL>,

  ol: ({ children }) => <OL>{children}</OL>,

  li: ({ children }) => <LI>{children}</LI>,

  blockquote: ({ children }) => <Blockquote>{children}</Blockquote>,

  a: ({ href, children }) => {
    if (href?.startsWith('tambo-resource://')) {
      const encodedUri = href.slice('tambo-resource://'.length)
      let uri: string
      try {
        uri = decodeURIComponent(encodedUri)
      } catch {
        uri = encodedUri
      }
      let name: string
      if (typeof children === 'string') {
        name = children
      } else if (typeof children === 'number') {
        name = String(children)
      } else if (Array.isArray(children)) {
        name = children
          .map((child) => (typeof child === 'string' ? child : String(child ?? '')))
          .join('')
      } else {
        name = String(children ?? uri)
      }
      return <ResourceMention name={name || uri} uri={uri} />
    }

    return (
      <StyledLink href={href} target="_blank" rel="noopener noreferrer">
        <span>{children}</span>
        <LinkIcon />
      </StyledLink>
    )
  },

  hr: () => <HR />,

  table: ({ children }) => (
    <TableWrapper>
      <Table>{children}</Table>
    </TableWrapper>
  ),

  th: ({ children }) => <TH>{children}</TH>,

  td: ({ children }) => <TD>{children}</TD>,
})

export const markdownComponents = createMarkdownComponents()
