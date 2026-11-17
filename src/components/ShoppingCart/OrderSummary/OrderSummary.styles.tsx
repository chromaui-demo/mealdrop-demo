import styled, { css } from 'styled-components'

import { Heading } from '../../typography/Heading'

export const StyledHeading = styled(Heading)<{ $withMargin?: boolean }>(
  ({
    $withMargin = false,
    theme: {
      typography: { fontSize },
    },
  }) => css`
    font-size: ${fontSize.heading4};
    margin-bottom: ${$withMargin ? '1.5rem' : 0};
  `
)

export const OrderSummaryContainer = styled.div<{ fixed?: boolean }>(
  ({ theme: { color, borderRadius } }) => css`
    width: 100%;
    min-height: 250px;
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    background-color: ${color.orderSummaryBackground};
    border-radius: ${borderRadius.s};
  `
)

export const BottomContainer = styled.div`
  margin-top: auto;
  border-top: 1px solid #f5f6f7;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

export const EmptyMessageContainer = styled.span`
  font-size: 18px;
  margin: 50px auto;
`

export const CartItemsContainer = styled.div`
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`

export const PromoSection = styled.div(
  ({ theme: { spacing } }) => css`
    margin-top: ${spacing.s};
    padding-top: ${spacing.s};
    border-top: 1px solid #f5f6f7;
  `
)

export const PromoForm = styled.form(
  ({ theme: { color, spacing } }) => css`
    display: flex;
    flex-direction: column;

    label {
      color: ${color.label};
      padding-bottom: ${spacing.xxs};
    }

    > div {
      display: flex;
      align-items: flex-start;
      gap: ${spacing.xs};
    }

    > div > div {
      flex: 1;
      min-width: 0;
    }

    /* Percentage width keeps the input from forcing the summary wider */
    input {
      width: 100%;
      min-width: 0;
      height: 44px;
    }

    button {
      flex-shrink: 0;
      height: 44px;
      padding-top: 0;
      padding-bottom: 0;
    }
  `
)

export const AppliedPromo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
`

export const PriceBreakdown = styled.div(
  ({ theme: { spacing } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${spacing.xxs};
    margin-top: ${spacing.s};
    margin-bottom: ${spacing.xs};
  `
)

export const PriceRow = styled.div`
  display: flex;
  justify-content: space-between;
`
