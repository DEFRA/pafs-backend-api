import { describe, it, expect } from 'vitest'
import { convertArray, convertNumber, convertBigInt } from './conversions.js'
describe('convertBigInt', () => {
  const TO_DB = 'toDatabase'
  const TO_API = 'toApi'

  it('should return null or undefined as is', () => {
    expect(convertBigInt(null, TO_DB)).toBeNull()
    expect(convertBigInt(undefined, TO_DB)).toBeUndefined()
    expect(convertBigInt(null, TO_API)).toBeNull()
    expect(convertBigInt(undefined, TO_API)).toBeUndefined()
  })

  describe('toDatabase direction', () => {
    it('should convert empty string to null', () => {
      expect(convertBigInt('', TO_DB)).toBeNull()
    })
    it('should return bigint as is', () => {
      expect(convertBigInt(1234n, TO_DB)).toBe(1234n)
    })
    it('should convert integer number to bigint', () => {
      expect(convertBigInt(42, TO_DB)).toBe(42n)
    })
    it('should return float number as is', () => {
      expect(convertBigInt(3.14, TO_DB)).toBe(3.14)
    })
    it('should convert valid string to bigint', () => {
      expect(convertBigInt('12345678901234567890', TO_DB)).toBe(
        BigInt('12345678901234567890')
      )
    })
    it('should return invalid string as is', () => {
      expect(convertBigInt('not-a-bigint', TO_DB)).toBe('not-a-bigint')
    })
    it('should return other types as is', () => {
      expect(convertBigInt({}, TO_DB)).toEqual({})
      expect(convertBigInt([], TO_DB)).toEqual([])
    })
  })

  describe('toApi direction', () => {
    it('should convert bigint to string', () => {
      expect(convertBigInt(1234n, TO_API)).toBe('1234')
    })
    it('should convert finite number to truncated string', () => {
      expect(convertBigInt(123.99, TO_API)).toBe('123')
      expect(convertBigInt(-456.7, TO_API)).toBe('-456')
    })
    it('should return non-finite number as is', () => {
      expect(convertBigInt(Infinity, TO_API)).toBe(Infinity)
      expect(convertBigInt(NaN, TO_API)).toBe(NaN)
    })
    it('should return string as is', () => {
      expect(convertBigInt('already-a-string', TO_API)).toBe('already-a-string')
    })
    it('should return other types as is', () => {
      expect(convertBigInt({}, TO_API)).toEqual({})
      expect(convertBigInt([], TO_API)).toEqual([])
    })
  })
})

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

    describe('float/decimal number handling', () => {
      describe('toDatabase direction', () => {
        it('should convert float string to float number', () => {
          const result = convertNumber('3.14', 'toDatabase')
          expect(result).toBe(3.14)
          expect(typeof result).toBe('number')
        })

        it('should pass through float number unchanged', () => {
          const result = convertNumber(3.14159, 'toDatabase')
          expect(result).toBe(3.14159)
          expect(typeof result).toBe('number')
        })

        it('should handle decimal strings correctly', () => {
          expect(convertNumber('1.5', 'toDatabase')).toBe(1.5)
          expect(convertNumber('0.5', 'toDatabase')).toBe(0.5)
          expect(convertNumber('10.25', 'toDatabase')).toBe(10.25)
          expect(convertNumber('100.999', 'toDatabase')).toBe(100.999)
        })

        it('should handle zero decimal correctly', () => {
          expect(convertNumber('1.0', 'toDatabase')).toBe(1)
          expect(convertNumber('5.0', 'toDatabase')).toBe(5)
        })
      })

      describe('toApi direction', () => {
        it('should convert float string to float number', () => {
          const result = convertNumber('2.718', 'toApi')
          expect(result).toBe(2.718)
          expect(typeof result).toBe('number')
        })

        it('should pass through float number unchanged', () => {
          const result = convertNumber(2.718, 'toApi')
          expect(result).toBe(2.718)
          expect(typeof result).toBe('number')
        })

        it('should handle decimal strings correctly', () => {
          expect(convertNumber('1.5', 'toApi')).toBe(1.5)
          expect(convertNumber('0.75', 'toApi')).toBe(0.75)
          expect(convertNumber('99.99', 'toApi')).toBe(99.99)
        })
      })

      describe('bidirectional float conversions', () => {
        it('should maintain float value through database and back to API', () => {
          const original = 3.14159
          const toDb = convertNumber(original, 'toDatabase')
          const backToApi = convertNumber(toDb, 'toApi')
          expect(backToApi).toBe(original)
        })

        it('should handle float string input through both directions', () => {
          const original = '2.718'
          const toDb = convertNumber(original, 'toDatabase')
          expect(toDb).toBe(2.718)
          const backToApi = convertNumber(toDb, 'toApi')
          expect(backToApi).toBe(2.718)
        })
      })
    })

    describe('edge cases and invalid inputs', () => {
      it('should handle invalid numeric strings by returning them unchanged', () => {
        expect(convertNumber('not-a-number', 'toDatabase')).toBe('not-a-number')
        expect(convertNumber('abc', 'toApi')).toBe('abc')
      })

      it('should handle empty string', () => {
        const result = convertNumber('', 'toDatabase')
        expect(result).toBe(null)
      })

      it('should handle scientific notation', () => {
        expect(convertNumber('1e3', 'toDatabase')).toBe(1000)
        expect(convertNumber('2.5e2', 'toApi')).toBe(250)
      })

      it('should handle negative floats', () => {
        expect(convertNumber('-3.14', 'toDatabase')).toBe(-3.14)
        expect(convertNumber(-2.718, 'toApi')).toBe(-2.718)
      })
    })
  })
})
