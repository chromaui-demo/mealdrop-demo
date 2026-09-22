import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { ContactDetails } from './ContactDetails'

const meta = {
  component: ContactDetails,
} satisfies Meta<typeof ContactDetails>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    formData: null,
    setFormData: fn(),
    onNext: fn(),
  },
}
