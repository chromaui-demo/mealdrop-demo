import type { Meta, StoryObj } from '@storybook/react'

import { restaurants } from '../../stub/restaurants'

import { RestaurantCard } from './RestaurantCard'
import { allModes } from '../../../.storybook/modes'

const meta = {
  title: 'Components/RestaurantCard',
  component: RestaurantCard,
  parameters: {
    design: {
      type: 'figspec',
      url: 'https://www.figma.com/file/3Q1HTCalD0lJnNvcMoEw1x/Mealdrop?type=design&node-id=1091-2986&mode=design&t=PGeoMU7t8HOFToQL-4',
    },
    chromatic: {
      modes: {
        light: allModes.light,
        dark: allModes.dark,
      },
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'minimum-paragraph-length',
            selector: 'p',
            impact: 'critical',
            all: ['paragraph-minimum-text'],
            any: [],
            none: [],
            metadata: {
              title: 'Minimum Paragraph Length',
              description: 'Ensures paragraphs have meaningful content',
              help: 'Paragraphs should contain at least 5 characters',
            },
          },
        ],
        checks: [
          {
            id: 'paragraph-minimum-text',
            evaluate: function evaluate(node: HTMLParagraphElement) {
              const textContent = node.textContent?.trim()
              return textContent && textContent.length > 0 ? textContent.length > 50 : false
            },
          },
        ],
      },
    },
  },
} satisfies Meta<typeof RestaurantCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    ...restaurants[0],
    name: 'Burger Kingdom',
  },
}

export const New: Story = {
  args: {
    ...Default.args,
    isNew: true,
  },
}

export const Closed: Story = {
  args: {
    ...Default.args,
    isClosed: true,
  },
}

export const Loading: Story = {
  args: {
    ...Default.args,
    isLoading: true,
  },
}
