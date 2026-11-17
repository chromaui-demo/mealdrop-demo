import { createSelector } from '@reduxjs/toolkit'

import { RootState } from '../store'
import { findPromoCode, getPromoDiscount } from '../cart/promo-codes'

const selectOrder = (state: RootState) => state.order

export const selectOrderItems = createSelector([selectOrder], (order) => order.items)

export const selectOrderPromoCode = createSelector(
  [selectOrder],
  (order) => order.promoCode ?? null
)

export const selectOrderSubtotal = createSelector([selectOrderItems], (items) =>
  items.reduce((acc, item) => acc + item.quantity * item.price, 0)
)

export const selectOrderTotal = createSelector(
  [selectOrderSubtotal, selectOrderPromoCode],
  (subtotal, promoCode) => subtotal - getPromoDiscount(findPromoCode(promoCode), subtotal)
)
