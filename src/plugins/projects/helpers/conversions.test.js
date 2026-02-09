import { describe, it, expect } from 'vitest'
import { convertArray, convertNumber } from './conversions.js'

describe('conversions', () => {
  describe('convertArray', () => {
    describe('toDatabase direction', () => {
      it('should convert array to comma-separated string', () => {
        const result = convertArray(['NFM', 'SUDS', 'PFR'], 'toDatabase')
        expect(result).toBe('NFM,SUDS,PFR')
      })

      it('should convert single element array to string', () => {
        const result = convertArray(['NFM'], 'toDatabase')
        expect(result).toBe('NFM')
      })

      it('should convert empty array to empty string', () => {
        const result = convertArray([], 'toDatabase')
        expect(result).toBe('')
      })

      it('should pass through non-array values unchanged', () => {
        expect(convertArray('already-a-string', 'toDatabase')).toBe(
          'already-a-string'
        )
        expect(convertArray(null, 'toDatabase')).toBeNull()
        expect(convertArray(undefined, 'toDatabase')).toBeUndefined()
      })
    })

    describe('toApi direction', () => {
      it('should convert comma-separated string to array', () => {
        const result = convertArray('NFM,SUDS,PFR', 'toApi')
        expect(result).toEqual(['NFM', 'SUDS', 'PFR'])
      })

      it('should convert single value string to single element array', () => {
        const result = convertArray('NFM', 'toApi')
        expect(result).toEqual(['NFM'])
      })

      it('should convert empty string to empty array', () => {
        const result = convertArray('', 'toApi')
        expect(result).toEqual([])
      })

      it('should convert null to empty array', () => {
        const result = convertArray(null, 'toApi')
        expect(result).toEqual([])
      })

      it('should convert undefined to empty array', () => {
        const result = convertArray(undefined, 'toApi')
        expect(result).toEqual([])
      })

      it('should pass through non-string values unchanged', () => {
        const array = ['NFM', 'SUDS']
        const result = convertArray(array, 'toApi')
        expect(result).toBe(array)
      })
    })
  })

  describe('convertNumber', () => {
    describe('toDatabase direction', () => {
      it('should convert string to number', () => {
        const result = convertNumber('2024', 'toDatabase')
        expect(result).toBe(2024)
        expect(typeof result).toBe('number')
      })

      it('should pass through number unchanged', () => {
        const result = convertNumber(2024, 'toDatabase')
        expect(result).toBe(2024)
        expect(typeof result).toBe('number')
      })

      it('should pass through null unchanged', () => {
        const result = convertNumber(null, 'toDatabase')
        expect(result).toBeNull()
      })

      it('should pass through undefined unchanged', () => {
        const result = convertNumber(undefined, 'toDatabase')
        expect(result).toBeUndefined()
      })

      it('should parse numeric strings correctly', () => {
        expect(convertNumber('2024', 'toDatabase')).toBe(2024)
        expect(convertNumber('0', 'toDatabase')).toBe(0)
        expect(convertNumber('1', 'toDatabase')).toBe(1)
      })
    })

    describe('toApi direction', () => {
      it('should convert string to number', () => {
        const result = convertNumber('2024', 'toApi')
        expect(result).toBe(2024)
        expect(typeof result).toBe('number')
      })

      it('should pass through number unchanged', () => {
        const result = convertNumber(2024, 'toApi')
        expect(result).toBe(2024)
        expect(typeof result).toBe('number')
      })

      it('should pass through null unchanged', () => {
        const result = convertNumber(null, 'toApi')
        expect(result).toBeNull()
      })

      it('should pass through undefined unchanged', () => {
        const result = convertNumber(undefined, 'toApi')
        expect(result).toBeUndefined()
      })

      it('should parse numeric strings correctly', () => {
        expect(convertNumber('2025', 'toApi')).toBe(2025)
        expect(convertNumber('2026', 'toApi')).toBe(2026)
        expect(convertNumber('2030', 'toApi')).toBe(2030)
      })
    })

    describe('bidirectional conversions', () => {
      it('should maintain value through database and back to API', () => {
        const original = 2024
        const toDb = convertNumber(original, 'toDatabase')
        const backToApi = convertNumber(toDb, 'toApi')
        expect(backToApi).toBe(original)
      })

      it('should handle string input through both directions', () => {
        const original = '2024'
        const toDb = convertNumber(original, 'toDatabase')
        expect(toDb).toBe(2024)
        const backToApi = convertNumber(toDb, 'toApi')
        expect(backToApi).toBe(2024)
      })
    })
  })
})
