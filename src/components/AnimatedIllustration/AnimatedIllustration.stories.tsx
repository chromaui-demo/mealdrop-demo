import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'

import { AnimatedIllustration } from './AnimatedIllustration'

const meta = {
  title: 'Components/AnimatedIllustration',
  component: AnimatedIllustration,
  parameters: {
    layout: 'fullscreen',
    storyshots: { disable: true },
  },
  // The animation JSON is lazy loaded, so wait until Lottie has drawn it before
  // the story counts as rendered. A fixed delay let Chromatic capture it blank.
  play: async ({ canvasElement }) => {
    await waitFor(
      () => expect(canvasElement.querySelector('svg path, svg image')).toBeInTheDocument(),
      {
        timeout: 10_000,
      }
    )
  },
  decorators: [
    (StoryEl) => (
      <div style={{ maxWidth: 400 }}>
        <StoryEl />
      </div>
    ),
  ],
} satisfies Meta<typeof AnimatedIllustration>

export default meta
type Story = StoryObj<typeof meta>

export const NotFound: Story = {
  args: {
    animation: 'NotFound',
  },
}

export const Error: Story = {
  args: {
    animation: 'Error',
  },
}
