import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { cartItems } from '../../../stub/cart-items'

import { OrderSummary } from './OrderSummary'

const meta = {
  title: 'Components/OrderSummary',
  component: OrderSummary,
} satisfies Meta<typeof OrderSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    cartItems,
  },
}

export const WithPromoCodeForm: Story = {
  args: {
    cartItems,
    onApplyPromoCode: fn(),
    onRemovePromoCode: fn(),
  },
}

export const ApplyingPromoCode: Story = {
  args: WithPromoCodeForm.args,
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Promo code'), ' welcome10 ')
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }))
    await expect(args.onApplyPromoCode).toHaveBeenCalledWith('WELCOME10')
  },
}

export const InvalidPromoCode: Story = {
  args: WithPromoCodeForm.args,
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Promo code'), 'FREEFOOD')
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }))
    await expect(canvas.getByText(`"FREEFOOD" isn't a valid promo code`)).toBeInTheDocument()
    await expect(args.onApplyPromoCode).not.toHaveBeenCalled()
  },
}

export const PercentagePromoApplied: Story = {
  args: {
    ...WithPromoCodeForm.args,
    promoCode: 'WELCOME10',
  },
}

export const AmountPromoApplied: Story = {
  args: {
    ...WithPromoCodeForm.args,
    promoCode: 'SAVE5',
  },
}

/** A fixed discount never takes the total below zero */
export const AmountPromoLargerThanSubtotal: Story = {
  args: {
    ...WithPromoCodeForm.args,
    cartItems: [cartItems[0]],
    promoCode: 'SAVE5',
  },
}

/** Read-only summary, as shown on the order confirmation page */
export const PromoAppliedReadOnly: Story = {
  args: {
    cartItems,
    promoCode: 'WELCOME10',
  },
}
