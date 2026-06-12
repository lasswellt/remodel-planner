// Single source of the primary nav. The floorplan is the home route (UX4:
// recognition over recall — the plan is the canonical way into a room).
export interface NavItem {
  title: string
  to: string
  icon: string
}

export const NAV_ITEMS: NavItem[] = [
  { title: 'Floorplan', to: '/', icon: 'mdi-floor-plan' },
  { title: 'Rooms', to: '/rooms', icon: 'mdi-view-grid-outline' },
  { title: 'Budget', to: '/budget', icon: 'mdi-cash-multiple' },
  { title: 'Tasks', to: '/tasks', icon: 'mdi-checkbox-marked-outline' },
  { title: 'Inspiration', to: '/inspiration', icon: 'mdi-image-multiple-outline' },
  { title: 'Research', to: '/research', icon: 'mdi-book-open-variant' },
]
