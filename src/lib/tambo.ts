/**
 * @file tambo.ts
 * @description Central configuration file for Tambo components and tools
 *
 * This file serves as the central place to register your Tambo components and tools.
 * It exports arrays that will be used by the TamboProvider.
 *
 * Read more about Tambo at https://tambo.co/docs
 */

import { RestaurantCard } from '@/components/RestaurantCard'
import type { TamboComponent } from '@tambo-ai/react'
import { TamboTool } from '@tambo-ai/react'
import { z } from 'zod'

/**
 * tools
 *
 * This array contains all the Tambo tools that are registered for use within the application.
 * Each tool is defined with its name, description, and expected props. The tools
 * can be controlled by AI to dynamically fetch data based on user interactions.
 */

export const tools: TamboTool[] = []

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
]
