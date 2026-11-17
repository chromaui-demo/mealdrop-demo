import { FormEvent, useMemo, useState } from 'react'

import { ShoppingCartItem } from '../ShoppingCartItem/ShoppingCartItem'
import {
  CartItem,
  describePromoCode,
  findPromoCode,
  getPromoDiscount,
} from '../../../app-state/cart'
import { Body } from '../../typography/Body'
import { Button } from '../../Button'
import { Input } from '../../forms/Input'
import { toCurrency } from '../../../helpers'

import {
  OrderSummaryContainer,
  BottomContainer,
  CartItemsContainer,
  StyledHeading,
  PromoSection,
  PromoForm,
  AppliedPromo,
  PriceRow,
  PriceBreakdown,
} from './OrderSummary.styles'

type OrderSummaryProps = {
  cartItems: CartItem[]
  /** Promo code applied to the order, if any */
  promoCode?: string | null
  /** When provided, shows a form so the customer can enter a promo code */
  onApplyPromoCode?: (code: string) => void
  /** When provided, lets the customer remove an applied promo code */
  onRemovePromoCode?: () => void
}

const PromoCodeForm = ({ onApply }: { onApply: (code: string) => void }) => {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!value.trim()) {
      setError('Enter a promo code')
      return
    }
    const promo = findPromoCode(value)
    if (!promo) {
      setError(`"${value.trim()}" isn't a valid promo code`)
      return
    }
    setError(undefined)
    setValue('')
    onApply(promo.code)
  }

  return (
    <PromoForm onSubmit={handleSubmit} noValidate>
      <Body type="label" htmlFor="promo-code">
        Promo code
      </Body>
      <div>
        <Input
          id="promo-code"
          name="promoCode"
          aria-label="Promo code"
          placeholder="Enter code"
          value={value}
          error={error}
          aria-invalid={!!error}
          onChange={(event) => {
            setValue(event.target.value)
            if (error) setError(undefined)
          }}
        />
        <Button type="submit">Apply</Button>
      </div>
    </PromoForm>
  )
}

export const OrderSummary = ({
  cartItems,
  promoCode,
  onApplyPromoCode,
  onRemovePromoCode,
}: OrderSummaryProps) => {
  const subtotal = useMemo(
    () => cartItems.map((item) => item.quantity * item.price).reduce((acc, next) => acc + next, 0),
    [cartItems]
  )
  const promo = findPromoCode(promoCode)
  const discount = getPromoDiscount(promo, subtotal)
  const total = subtotal - discount
  const hasItems = cartItems.length > 0

  return (
    <>
      <OrderSummaryContainer>
        <StyledHeading level={3} $withMargin>
          Your order
        </StyledHeading>
        <CartItemsContainer>
          {hasItems ? (
            cartItems.map((item) => <ShoppingCartItem key={item.id} item={item} />)
          ) : (
            <Body>Your cart is empty.</Body>
          )}
        </CartItemsContainer>
        {hasItems && promo && (
          <PromoSection>
            <AppliedPromo>
              <div>
                <Body type="span" fontWeight="bold">
                  {promo.code}
                </Body>
                <Body type="span" size="S">
                  {describePromoCode(promo)} applied
                </Body>
              </div>
              {onRemovePromoCode && (
                <Button
                  clear
                  onClick={onRemovePromoCode}
                  aria-label={`Remove promo code ${promo.code}`}
                >
                  Remove
                </Button>
              )}
            </AppliedPromo>
          </PromoSection>
        )}
        {hasItems && !promo && onApplyPromoCode && (
          <PromoSection>
            <PromoCodeForm onApply={onApplyPromoCode} />
          </PromoSection>
        )}
        {discount > 0 && (
          <PriceBreakdown>
            <PriceRow>
              <Body type="span">Subtotal</Body>
              <Body type="span">{toCurrency(subtotal)}</Body>
            </PriceRow>
            <PriceRow>
              <Body type="span">Discount</Body>
              <Body type="span">−{toCurrency(discount)}</Body>
            </PriceRow>
          </PriceBreakdown>
        )}
        <BottomContainer>
          <Body>Total</Body>
          <StyledHeading level={2}>{toCurrency(total)}</StyledHeading>
        </BottomContainer>
      </OrderSummaryContainer>
    </>
  )
}
