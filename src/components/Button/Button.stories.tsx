import { userEvent, within } from '@storybook/test';
import { StoryObj, Meta } from '@storybook/react'

import { allModes } from '../../../.storybook/modes'

import { Button } from './Button'

const meta = {
  title: 'Components/Button',
  component: Button,
  args: {
    children: 'Button',
  },
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/3Q1HTCalD0lJnNvcMoEw1x/Mealdrop?node-id=1005%3A2974&t=8pzYUq8GyzmMGjJ2-4',
    },
  },
} satisfies Meta<typeof Button>
export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const Clear: Story = {
  args: {
    clear: true,
  },
}

export const Icon: Story = {
  args: {
    icon: 'cart',
    'aria-label': 'cart',
  },
}

export const IconAndText: Story = {
  args: {
    icon: 'cart',
    children: (
      <div style={{ paddingLeft: '16px' }}>
        <span style={{ color: '#949494' }}>Order</span>
        <span style={{ color: 'white', paddingLeft: '8px' }}>€ 8</span>
      </div>
    ),
  },
}

export const Rounded: Story = {
  args: {
    children: 'Button',
    clear: false,
    round: true,
  },

  parameters: {
    chromatic: {
      modes: {
        light: allModes.light,
        dark: allModes.dark,
      },
    },
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole('button', { name: 'Button' }));
  }
}
