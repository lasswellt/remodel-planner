import type { PurchaseStatus } from '~/models'
import { PurchaseStatus as StatusEnum } from '~/models'

// Display labels + chip colors for purchase status, shared by the purchase card
// and dialog. Slugs are the enum values.
export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  'idea': 'Idea',
  'to-buy': 'To buy',
  'purchased': 'Purchased',
}

export const PURCHASE_STATUS_COLORS: Record<PurchaseStatus, string> = {
  'idea': 'grey',
  'to-buy': 'primary',
  'purchased': 'success',
}

export const PURCHASE_STATUS_OPTIONS = StatusEnum.options.map(value => ({
  value,
  title: PURCHASE_STATUS_LABELS[value],
}))

// Suggested groupings — free text, so users add their own. These seed the group
// combobox and the empty-state quick-add chips.
export const PURCHASE_GROUP_SUGGESTIONS = [
  'Vanities',
  'Tubs',
  'Showers',
  'Faucets',
  'Lighting',
  'Mirrors',
  'Tile',
  'Flooring',
  'Hardware',
  'Appliances',
  'Cabinets',
  'Countertops',
  'Couches',
  'Chairs',
  'Tables',
  'Storage',
  'Decor',
]
