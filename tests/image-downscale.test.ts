import { describe, expect, it } from 'vitest'
import { backoffDelay, fitDimensions } from '../app/utils/image-downscale'

describe('fitDimensions', () => {
  it('scales down so the longest edge equals maxEdge, preserving aspect ratio', () => {
    expect(fitDimensions(4000, 3000, 2000)).toEqual({ w: 2000, h: 1500 })
    expect(fitDimensions(3000, 4000, 2000)).toEqual({ w: 1500, h: 2000 })
  })

  it('never upscales an image already within bounds', () => {
    expect(fitDimensions(800, 600, 2000)).toEqual({ w: 800, h: 600 })
  })

  it('handles square images', () => {
    expect(fitDimensions(2000, 2000, 1000)).toEqual({ w: 1000, h: 1000 })
  })

  it('is safe on zero dimensions', () => {
    expect(fitDimensions(0, 0, 1000)).toEqual({ w: 0, h: 0 })
  })
})

describe('backoffDelay', () => {
  it('doubles from the base each attempt', () => {
    expect(backoffDelay(0)).toBe(500)
    expect(backoffDelay(1)).toBe(1000)
    expect(backoffDelay(2)).toBe(2000)
    expect(backoffDelay(3)).toBe(4000)
  })

  it('caps at the max', () => {
    expect(backoffDelay(10)).toBe(8000)
    expect(backoffDelay(5, 1000, 6000)).toBe(6000)
  })
})
