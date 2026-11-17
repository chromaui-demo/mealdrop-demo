import { toCurrency } from '../../helpers'

type PercentOff = { type: 'percent'; percentOff: number }
type AmountOff = { type: 'amount'; amountOff: number }

export type PromoCode = { code: string } & (PercentOff | AmountOff)

const promoCodes: PromoCode[] = [
  { code: 'WELCOME10', type: 'percent', percentOff: 10 },
  { code: 'SAVE5', type: 'amount', amountOff: 5 },
]

export const normalizePromoCode = (input: string) => input.trim().toUpperCase()

export const findPromoCode = (input: string | null | undefined): PromoCode | undefined => {
  if (!input) return undefined
  const code = normalizePromoCode(input)
  return promoCodes.find((promo) => promo.code === code)
}

/** Human readable description of what the promo code gives, e.g. "10% off" */
export const describePromoCode = (promo: PromoCode) =>
  promo.type === 'percent' ? `${promo.percentOff}% off` : `${toCurrency(promo.amountOff)} off`

/** Discount for the given subtotal, rounded to cents and never more than the subtotal */
export const getPromoDiscount = (promo: PromoCode | undefined, subtotal: number) => {
  if (!promo || subtotal <= 0) return 0
  const discount = promo.type === 'percent' ? (subtotal * promo.percentOff) / 100 : promo.amountOff
  return Math.round(Math.min(discount, subtotal) * 100) / 100
}
