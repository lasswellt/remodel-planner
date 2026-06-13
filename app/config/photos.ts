import type { PhotoStage } from '~/models'
import { PhotoStage as StageEnum } from '~/models'

export const PHOTO_STAGES: readonly PhotoStage[] = StageEnum.options

export const PHOTO_STAGE_LABELS: Record<PhotoStage, string> = {
  before: 'Before',
  during: 'During',
  after: 'After',
}

export const PHOTO_STAGE_COLOR: Record<PhotoStage, string> = {
  before: 'grey',
  during: 'info',
  after: 'success',
}
