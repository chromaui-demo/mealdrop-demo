'use client'

import styled, { keyframes } from 'styled-components'
import { type GenerationStage, useTambo } from '@tambo-ai/react'
import { Loader2Icon } from 'lucide-react'
import * as React from 'react'

export interface GenerationStageProps extends React.HTMLAttributes<HTMLDivElement> {
  showLabel?: boolean
}

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`

const StageContainer = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border-radius: 0.375rem;
  background-color: transparent;
  color: #6b7280;
`

const SpinningLoader = styled(Loader2Icon)`
  height: 0.75rem;
  width: 0.75rem;
  animation: ${spin} 1s linear infinite;
`

export function MessageGenerationStage({ showLabel = true, ...props }: GenerationStageProps) {
  const { thread, isIdle } = useTambo()
  const stage = thread?.generationStage

  if (!stage) {
    return null
  }

  const stageLabels: Record<GenerationStage, string> = {
    IDLE: 'Idle',
    CHOOSING_COMPONENT: 'Choosing component',
    FETCHING_CONTEXT: 'Fetching context',
    HYDRATING_COMPONENT: 'Preparing component',
    STREAMING_RESPONSE: 'Generating response',
    COMPLETE: 'Complete',
    ERROR: 'Error',
    CANCELLED: 'Cancelled',
  }

  const label = stageLabels[stage] || stage.charAt(0).toUpperCase() + stage.slice(1)

  if (isIdle) {
    return null
  }

  return (
    <StageContainer {...props}>
      <SpinningLoader />
      {showLabel && <span>{label}</span>}
    </StageContainer>
  )
}
