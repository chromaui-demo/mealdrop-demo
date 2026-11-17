import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'

import { CheckoutPage } from './CheckoutPage'

const meta = {
  title: 'Pages/CheckoutPage',
  component: CheckoutPage,
  parameters: {
    layout: 'fullscreen',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/3Q1HTCalD0lJnNvcMoEw1x/Mealdrop?type=design&node-id=426-3291&mode=design&t=PGeoMU7t8HOFToQL-4',
    },
  },
} satisfies Meta<typeof CheckoutPage>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithItems: Story = {
  parameters: {
    store: {
      initialState: {
        cart: {
          visible: false,
          items: [
            {
              id: 2,
              name: 'Fries',
              description: 'Fried french fries',
              price: 2.5,
              quantity: 2,
            },
            {
              id: 1,
              name: 'Cheeseburger',
              description: 'Nice grilled burger with cheese',
              price: 8.5,
              quantity: 1,
            },
          ],
        },
      },
    },
  },
}

export const WithPromoCode: Story = {
  parameters: {
    store: {
      initialState: {
        cart: {
          ...WithItems.parameters?.store.initialState.cart,
          promoCode: 'WELCOME10',
        },
      },
    },
  },
}

export const ApplyPromoCode: Story = {
  parameters: WithItems.parameters,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Promo code'), 'SAVE5')
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }))
    await expect(await canvas.findByText('Discount (SAVE5)')).toBeInTheDocument()
    await expect(
      canvas.getByText('Promo code', { exact: false, selector: 'span' })
    ).toHaveTextContent('Promo code SAVE5 applied')
  },
}
