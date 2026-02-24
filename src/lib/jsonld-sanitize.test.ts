import { describe, expect, it } from 'vitest'
import { sanitizeJsonLd, createSafeJsonLdScript } from './jsonld-sanitize'

describe('jsonld-sanitize', () => {
  describe('sanitizeJsonLd', () => {
    it('serializes simple object', () => {
      const obj = { '@type': 'Person', name: 'John' }
      const result = sanitizeJsonLd(obj)
      expect(result).toBe('{"@type":"Person","name":"John"}')
    })

    it('escapes less-than signs', () => {
      const obj = { description: '<script>alert("xss")</script>' }
      const result = sanitizeJsonLd(obj)
      expect(result).not.toContain('<script>')
      expect(result).toContain('\\u003cscript\\u003e')
    })

    it('escapes greater-than signs', () => {
      const obj = { description: 'value > 10' }
      const result = sanitizeJsonLd(obj)
      expect(result).not.toContain('>')
      expect(result).toContain('\\u003e')
    })

    it('removes javascript: protocol', () => {
      const obj = { url: 'javascript:alert("xss")' }
      const result = sanitizeJsonLd(obj)
      expect(result).not.toContain('javascript:')
    })

    it('removes event handlers', () => {
      const obj = { onclick: 'stealCookies()' }
      const result = sanitizeJsonLd(obj)
      expect(result).not.toContain('onclick')
    })

    it('handles nested objects', () => {
      const obj = {
        '@type': 'Organization',
        name: 'Test Corp',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '<b>Main St</b>',
        },
      }
      const result = sanitizeJsonLd(obj)
      expect(result).not.toContain('<b>')
      expect(result).toContain('\\u003cb\\u003e')
    })

    it('handles arrays', () => {
      const obj = {
        items: [
          { name: '<script>' },
          { name: '<img>' },
        ],
      }
      const result = sanitizeJsonLd(obj)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('<img>')
    })

    it('handles null values', () => {
      const obj = { name: null, value: undefined }
      const result = sanitizeJsonLd(obj)
      expect(result).toContain('null')
    })

    it('handles special characters', () => {
      const obj = { text: 'Hello \n World \t Test' }
      const result = sanitizeJsonLd(obj)
      expect(result).toBe('{"text":"Hello \\n World \\t Test"}')
    })

    it('handles unicode characters', () => {
      const obj = { emoji: '🚀', chinese: '中文' }
      const result = sanitizeJsonLd(obj)
      expect(result).toContain('🚀')
      expect(result).toContain('中文')
    })

    it('prevents closing script tag injection', () => {
      const obj = { content: '</script><script>alert(1)</script>' }
      const result = sanitizeJsonLd(obj)
      expect(result).not.toContain('</script>')
      expect(result).toContain('\\u003c/script\\u003e')
    })

    it('handles deeply nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              value: '<script>',
            },
          },
        },
      }
      const result = sanitizeJsonLd(obj)
      expect(result).not.toContain('<script>')
    })

    it('handles empty objects', () => {
      const result = sanitizeJsonLd({})
      expect(result).toBe('{}')
    })

    it('handles empty arrays', () => {
      const result = sanitizeJsonLd({ items: [] })
      expect(result).toBe('{"items":[]}')
    })

    it('preserves numbers and booleans', () => {
      const obj = { count: 42, active: true, ratio: 3.14 }
      const result = sanitizeJsonLd(obj)
      expect(result).toBe('{"count":42,"active":true,"ratio":3.14}')
    })
  })

  describe('createSafeJsonLdScript', () => {
    it('returns object with __html property', () => {
      const obj = { '@type': 'Person', name: 'John' }
      const result = createSafeJsonLdScript(obj)
      
      expect(result).toHaveProperty('__html')
      expect(typeof result.__html).toBe('string')
    })

    it('returns sanitized content', () => {
      const obj = { script: '<script>alert(1)</script>' }
      const result = createSafeJsonLdScript(obj)
      
      expect(result.__html).not.toContain('<script>')
      expect(result.__html).toContain('\\u003cscript\\u003e')
    })

    it('can be used with dangerouslySetInnerHTML', () => {
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'PointsMax',
      }
      const result = createSafeJsonLdScript(jsonLd)
      
      // Simulating React's dangerouslySetInnerHTML usage
      expect(result).toEqual({ __html: expect.any(String) })
      expect(result.__html).toContain('https://schema.org')
      expect(result.__html).toContain('WebApplication')
    })

    it('handles real-world schema.org example', () => {
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'PointsMax',
        description: 'Find the <b>best</b> value for your points',
        url: 'https://pointsmax.com',
      }
      
      const result = createSafeJsonLdScript(jsonLd)
      
      expect(result.__html).toContain('https://schema.org')
      expect(result.__html).toContain('PointsMax')
      // HTML tags should be escaped
      expect(result.__html).not.toContain('<b>')
      expect(result.__html).toContain('\\u003cb\\u003e')
    })
  })
})
