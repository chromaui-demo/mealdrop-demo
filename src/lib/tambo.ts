/**
 * @file tambo.ts
 * @description Central configuration file for Tambo components and tools
 *
 * This file serves as the central place to register your Tambo components and tools.
 * It exports arrays that will be used by the TamboProvider.
 *
 * Read more about Tambo at https://tambo.co/docs
 */

import { api } from '@/api'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Category } from '@/components/Category'
import { Icon } from '@/components/Icon'
import { IconButton } from '@/components/IconButton'
import { RestaurantCard } from '@/components/RestaurantCard'
import { Review } from '@/components/Review'
import { OrderSummary } from '@/components/ShoppingCart'
import { ShoppingCartMenu } from '@/components/ShoppingCartMenu'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Select'
import { Body, Heading } from '@/components/typography'
import { CategoryList } from '@/pages/CategoryListPage/components/CategoryList'
import { AwardWinningSection } from '@/pages/HomePage/components/AwardWinningSection'
import { FoodItem } from '@/pages/RestaurantDetailPage/components/FoodItem'
import type { TamboComponent } from '@tambo-ai/react'
import { TamboTool } from '@tambo-ai/react'
import { z } from 'zod'

// Shared icon name enum used by Button, Icon, and IconButton
const IconNameSchema = z.enum([
  'arrow-right',
  'arrow-left',
  'cross',
  'cart',
  'minus',
  'plus',
  'moon',
  'sun',
  'star',
])

/**
 * tools
 *
 * This array contains all the Tambo tools that are registered for use within the application.
 * Each tool is defined with its name, description, and expected props. The tools
 * can be controlled by AI to dynamically fetch data based on user interactions.
 */

// Schema for restaurant data returned by tools
const FoodMenuItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
})

const RestaurantSchema = z.object({
  name: z.string(),
  id: z.string().optional(),
  mapsUrl: z.string().optional(),
  rating: z.number().optional(),
  url: z.string().optional(),
  address: z.string().optional(),
  specialty: z.string(),
  photoUrl: z.string(),
  isClosed: z.boolean().optional(),
  categories: z.array(z.string()).optional(),
  isLoading: z.boolean().optional(),
  isNew: z.boolean().optional(),
  menu: z.object({
    food: z.array(FoodMenuItemSchema),
    dessert: z.array(FoodMenuItemSchema),
    drinks: z.array(FoodMenuItemSchema),
  }),
})

export const tools: TamboTool[] = [
  {
    name: 'getRestaurants',
    description:
      'Fetches all available restaurants. Returns an array of restaurant objects with their details including name, specialty, rating, photo, categories, and menu items.',
    tool: async () => {
      const restaurants = await api.getRestaurants()
      return restaurants
    },
    toolSchema: z.function().args(z.object({})).returns(z.array(RestaurantSchema)),
  },
  {
    name: 'getRestaurantById',
    description:
      'Fetches a specific restaurant by its unique ID. Returns detailed restaurant information including name, specialty, rating, photo, address, categories, and full menu.',
    tool: async ({ id }: { id: string }) => {
      const restaurant = await api.getRestaurantById(id)
      return restaurant
    },
    toolSchema: z
      .function()
      .args(
        z.object({
          id: z.string().describe('The unique identifier of the restaurant to fetch'),
        })
      )
      .returns(RestaurantSchema),
  },
  {
    name: 'getRestaurantsByCategory',
    description:
      'Fetches restaurants filtered by a specific food category (e.g., "pizza", "sushi", "burger", "italian", "chinese"). Returns an array of restaurants that serve that type of cuisine.',
    tool: async ({ category }: { category: string }) => {
      const restaurants = await api.getRestaurantsByCategory(category)
      return restaurants
    },
    toolSchema: z
      .function()
      .args(
        z.object({
          category: z
            .string()
            .describe(
              'The food category to filter by (e.g., "pizza", "sushi", "burger", "italian", "chinese")'
            ),
        })
      )
      .returns(z.array(RestaurantSchema)),
  },
  {
    name: 'rateRestaurant',
    description:
      'Allows users to submit a rating for a specific restaurant by its ID. Accepts a rating value from 1 to 5 and returns the updated restaurant information including the new average rating.',
    tool: async ({ rating, comment }: { rating: number; comment: string }) => {
      return await Promise.resolve({ confirmation: 'Rating submitted', rating, comment }) // Mock implementation
    },
    toolSchema: z
      .function()
      .args(
        z.object({
          rating: z.number().min(1).max(5).describe('Rating value from 1 to 5'),
          comment: z.string().optional().describe('Optional comment about the restaurant'),
        })
      )
      .returns(
        z.object({ confirmation: z.string(), rating: z.number(), comment: z.string().optional() })
      ),
  },
]

export const RestaurantCardPropsSchema = z
  .object({
    name: z.string(),
    rating: z.number().optional(),
    specialty: z.string(),
    photoUrl: z.string(),
    isClosed: z.boolean().optional(),
    categories: z.array(z.string()).optional(),
    isLoading: z.boolean().optional(),
    isNew: z.boolean().optional(),
    onClick: z.function().optional(),
    className: z.string().optional(),
  })
  .describe('Displays information about a restaurant in a card format.')

export const ButtonPropsSchema = z
  .object({
    clear: z.boolean().optional().describe('Clear button styles leaving just text'),
    round: z.boolean().optional(),
    large: z.boolean().optional().describe('Is the button large?'),
    icon: IconNameSchema.optional().describe('Icon to display in the button'),
    iconSize: z.number().optional().describe('Size of the icon'),
    disabled: z.boolean().optional().describe('Is the button disabled?'),
    children: z.string().optional().describe('Button text content'),
    onClick: z.function().optional().describe('Click handler'),
  })
  .describe('Primary UI component for user interaction.')

export const BadgePropsSchema = z
  .object({
    text: z.string().describe('Text to display in the badge'),
    className: z.string().optional(),
  })
  .describe('A small badge component for displaying labels or tags.')

export const CategoryPropsSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().describe('Category title'),
    photoUrl: z.string().describe('URL for the category image'),
    round: z.boolean().optional().describe('Display as rounded'),
  })
  .describe('A category card displaying a food category with image and title.')

export const IconPropsSchema = z
  .object({
    name: IconNameSchema.describe('Icon name'),
    color: z.string().optional().describe('Icon color'),
    size: z.union([z.number(), z.string()]).optional().describe('Icon size'),
  })
  .describe('An icon component that renders various icons.')

export const IconButtonPropsSchema = z
  .object({
    name: IconNameSchema.describe('Icon name'),
    small: z.boolean().optional().describe('Small size variant'),
    onClick: z.function().optional().describe('Click handler'),
  })
  .describe('A button component that displays an icon.')

export const ReviewPropsSchema = z
  .object({
    rating: z.number().optional().describe('Rating value from 0 to 5'),
  })
  .describe('A review component displaying star ratings.')

export const InputPropsSchema = z
  .object({
    label: z.string().optional().describe('Label text for the input'),
    value: z.string().optional().describe('Input value'),
    onChange: z.function().optional().describe('Change handler'),
    error: z.string().optional().describe('Error message to display'),
    type: z.string().optional().describe('Input type (text, email, password, etc.)'),
    placeholder: z.string().optional().describe('Placeholder text'),
  })
  .describe('A form input component with optional label and error display.')

export const SelectPropsSchema = z
  .object({
    label: z.string().optional().describe('Label text for the select'),
    options: z.array(z.string()).optional().describe('Array of options'),
    value: z.string().optional().describe('Selected value'),
    onChange: z.function().optional().describe('Change handler'),
  })
  .describe('A form select/dropdown component.')

export const BodyPropsSchema = z
  .object({
    children: z.string().describe('Text content'),
    className: z.string().optional(),
    size: z.enum(['S', 'XS', 'XXS']).optional().describe('Text size'),
    fontWeight: z.enum(['regular', 'medium', 'bold', 'black']).optional().describe('Font weight'),
    type: z.enum(['span', 'p', 'label', 'figcaption']).optional().describe('HTML element type'),
    color: z.string().optional().describe('Text color'),
  })
  .describe('A body text component for paragraphs and text content.')

export const HeadingPropsSchema = z
  .object({
    children: z.string().describe('Heading text content'),
    level: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
      .optional()
      .describe('Heading level (1-5)'),
    className: z.string().optional(),
  })
  .describe('A heading component for titles and section headers.')

// CartItem schema for OrderSummary and ShoppingCartMenu
const CartItemSchema = z.object({
  id: z.number().describe('Unique identifier for the cart item'),
  name: z.string().describe('Name of the item'),
  price: z.number().describe('Price of the item'),
  imageUrl: z.string().optional().describe('URL for the item image'),
  description: z.string().optional().describe('Description of the item'),
  quantity: z.number().describe('Quantity of the item in the cart'),
})

export const OrderSummaryPropsSchema = z
  .object({
    cartItems: z.array(CartItemSchema).describe('Array of items in the cart'),
  })
  .describe('Displays a summary of items in the shopping cart with prices.')

export const ShoppingCartMenuPropsSchema = z
  .object({
    isOpen: z.boolean().describe('Whether the shopping cart menu is open'),
    totalPrice: z.number().describe('Total price of all items in the cart'),
    onClose: z.function().describe('Handler called when the cart menu is closed'),
    cartItems: z.array(CartItemSchema).describe('Array of items in the cart'),
    onGoToCheckoutClick: z
      .function()
      .optional()
      .describe('Handler called when checkout button is clicked'),
    onItemChange: z.function().describe('Handler called when an item quantity changes'),
  })
  .describe('A sliding cart menu that displays cart items and total price.')

// CategoryItem schema for CategoryList
const CategoryItemSchema = z.object({
  id: z.string().optional().describe('Unique identifier for the category'),
  title: z.string().describe('Title of the category'),
  photoUrl: z.string().describe('URL for the category image'),
})

export const CategoryListPropsSchema = z
  .object({
    categories: z.array(CategoryItemSchema).describe('Array of category items to display'),
  })
  .describe('Displays a grid of food categories with images and titles.')

export const AwardWinningSectionPropsSchema = z
  .object({})
  .describe('A promotional section showcasing award-winning restaurants.')

export const FoodItemPropsSchema = z
  .object({
    name: z.string().describe('Name of the food item'),
    price: z.number().describe('Price of the food item'),
    description: z.string().optional().describe('Description of the food item'),
    quantity: z.number().optional().describe('Quantity of the item in the cart'),
    onClick: z.function().describe('Handler called when the food item is clicked'),
  })
  .describe('Displays a food menu item with name, price, and description.')

/**
 * components
 *
 * This array contains all the Tambo components that are registered for use within the application.
 * Each component is defined with its name, description, and expected props. The components
 * can be controlled by AI to dynamically render UI elements based on user interactions.
 */
export const components: TamboComponent[] = [
  {
    name: 'RestaurantCard',
    description:
      'A component that renders a card displaying restaurant information such as name, specialty, rating, and photo.',
    component: RestaurantCard,
    propsSchema: RestaurantCardPropsSchema,
  },
  {
    name: 'Button',
    description:
      'A primary button component for user interaction. Supports icons, different sizes, and clear styles.',
    component: Button,
    propsSchema: ButtonPropsSchema,
  },
  {
    name: 'Badge',
    description: 'A small badge component for displaying labels, tags, or categories.',
    component: Badge,
    propsSchema: BadgePropsSchema,
  },
  {
    name: 'Category',
    description: 'A category card component that displays a food category with an image and title.',
    component: Category,
    propsSchema: CategoryPropsSchema,
  },
  {
    name: 'Icon',
    description:
      'An icon component that renders various icons like arrows, cart, plus, minus, etc.',
    component: Icon,
    propsSchema: IconPropsSchema,
  },
  {
    name: 'IconButton',
    description:
      'A circular button component that displays an icon. Useful for actions like navigation or close buttons.',
    component: IconButton,
    propsSchema: IconButtonPropsSchema,
  },
  {
    name: 'Review',
    description: 'A review component that displays star ratings from 0 to 5.',
    component: Review,
    propsSchema: ReviewPropsSchema,
  },
  {
    name: 'Input',
    description: 'A form input component with optional label and error message display.',
    component: Input,
    propsSchema: InputPropsSchema,
  },
  {
    name: 'Select',
    description: 'A form select/dropdown component for choosing from a list of options.',
    component: Select,
    propsSchema: SelectPropsSchema,
  },
  {
    name: 'Body',
    description:
      'A body text component for paragraphs and text content with various sizes and font weights.',
    component: Body,
    propsSchema: BodyPropsSchema,
  },
  {
    name: 'Heading',
    description: 'A heading component for titles and section headers. Supports levels 1-5.',
    component: Heading,
    propsSchema: HeadingPropsSchema,
  },
  {
    name: 'OrderSummary',
    description:
      'A component that displays a summary of items in the shopping cart, including item names, quantities, and prices.',
    component: OrderSummary,
    propsSchema: OrderSummaryPropsSchema,
  },
  {
    name: 'ShoppingCartMenu',
    description:
      'A sliding menu panel that displays the shopping cart contents, total price, and checkout options.',
    component: ShoppingCartMenu,
    propsSchema: ShoppingCartMenuPropsSchema,
  },
  {
    name: 'CategoryList',
    description:
      'A grid component that displays a list of food categories with images and titles, linking to category detail pages.',
    component: CategoryList,
    propsSchema: CategoryListPropsSchema,
  },
  {
    name: 'AwardWinningSection',
    description:
      'A promotional section that showcases award-winning restaurants with decorative illustrations.',
    component: AwardWinningSection,
    propsSchema: AwardWinningSectionPropsSchema,
  },
  {
    name: 'FoodItem',
    description:
      'A component that displays a food menu item with its name, price, description, and optional quantity badge.',
    component: FoodItem,
    propsSchema: FoodItemPropsSchema,
  },
]
