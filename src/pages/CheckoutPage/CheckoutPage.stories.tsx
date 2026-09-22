import { userEvent, within, waitFor, expect } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite'

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

export const FormRequiredTest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole('textbox', { name: 'First name' }));
    await userEvent.type(await canvas.findByRole('textbox', { name: 'First name' }), 'John');
    await userEvent.tab();
    await userEvent.type(await canvas.findByRole('textbox', { name: 'Last name' }), 'Doe');
    await userEvent.tab();
    await userEvent.click(await canvas.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect((canvas.queryAllByText('Required', { exact: true }))[0]).toHaveTextContent('Required'));
    await waitFor(() => expect((canvas.queryAllByText('Required', { exact: true }))[1]).toHaveTextContent('Required'));
  }
};
