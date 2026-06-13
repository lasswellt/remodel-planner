import type { InspectionStatus, PermitStatus } from '~/models'

// Common Cobb County, GA residential permit scopes offered as quick-add chips.
// Fees are NOT hardcoded — the county schedule changes; the user enters the
// actual fee per permit (Build/spec requirement).
export const COBB_PERMIT_SCOPES = [
  'Building / structural',
  'Electrical',
  'Plumbing',
  'Mechanical (HVAC)',
  'Demolition',
  'Roofing',
]

export const DEFAULT_AUTHORITY = 'Cobb County'

export const PERMIT_STATUS_LABELS: Record<PermitStatus, string> = {
  needed: 'Needed',
  applied: 'Applied',
  issued: 'Issued',
  closed: 'Closed',
}
export const PERMIT_STATUS_COLOR: Record<PermitStatus, string> = {
  needed: 'grey',
  applied: 'info',
  issued: 'primary',
  closed: 'success',
}

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  passed: 'Passed',
  failed: 'Failed',
}
export const INSPECTION_STATUS_COLOR: Record<InspectionStatus, string> = {
  pending: 'grey',
  scheduled: 'info',
  passed: 'success',
  failed: 'error',
}
