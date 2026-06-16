import type { ItemStatus } from '~/models'
import { ItemStatus as StatusEnum } from '~/models'

// Display labels + chip colors for the unified item lifecycle, shared by the
// items section, card, and dialog. Slugs are the enum values.
export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  'idea': 'Idea',
  'to-buy': 'To buy',
  'purchased': 'Purchased',
  'delivered': 'Delivered',
  'installed': 'Installed',
}

export const ITEM_STATUS_COLORS: Record<ItemStatus, string> = {
  'idea': 'grey',
  'to-buy': 'primary',
  'purchased': 'info',
  'delivered': 'teal',
  'installed': 'success',
}

export const ITEM_STATUS_OPTIONS = StatusEnum.options.map(value => ({
  value,
  title: ITEM_STATUS_LABELS[value],
}))

// Suggested grouping categories — free text, so users add their own. These seed
// the category combobox and the empty-state quick-add chips.
export const CATEGORY_SUGGESTIONS = [
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
