import { createSlice, CaseReducer, PayloadAction } from '@reduxjs/toolkit'

import { CartItem } from '../cart'

export type OrderState = {
  items: CartItem[]
  promoCode?: string | null
}

type SaveOrderPayload = {
  items: CartItem[]
  promoCode?: string | null
}

const saveOrder: CaseReducer<OrderState, PayloadAction<SaveOrderPayload>> = (state, action) => {
  state.items = action.payload.items
  state.promoCode = action.payload.promoCode ?? null
}

const clearOrder: CaseReducer<OrderState> = (state) => {
  state.items = []
  state.promoCode = null
}

const initialState: OrderState = {
  items: [],
  promoCode: null,
}

const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    saveOrderAction: saveOrder,
    clearOrderAction: clearOrder,
  },
})

// Extract the action creators object and the reducer
export const { actions, reducer } = orderSlice

// Extract and export each action creator by name
export const { saveOrderAction, clearOrderAction } = actions

// Export the reducer, either as a default or named export
export default reducer
