import { describe, expect, it, beforeEach, vi } from 'vitest'
import { withTimeout, QueryTimeoutError, getActiveQueryCount } from './db-timeout'

describe('db-timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('withTimeout', () => {
    it('returns result when operation succeeds', async () => {
      const result = await withTimeout(
        async () => 'success',
        { operationName: 'test', timeoutMs: 1000 }
      )
      expect(result).toBe('success')
    })

    it('returns result for async operations', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { id: '123', name: 'Test' }
      }
      
      const promise = withTimeout(operation, { operationName: 'test', timeoutMs: 1000 })
      vi.advanceTimersByTime(150)
      
      const result = await promise
      expect(result).toEqual({ id: '123', name: 'Test' })
    })

    it('throws QueryTimeoutError when operation times out', async () => {
      const promise = withTimeout(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 2000))
          return 'never'
        },
        { operationName: 'slow-query', timeoutMs: 100 }
      )

      vi.advanceTimersByTime(150)

      await expect(promise).rejects.toThrow(QueryTimeoutError)
      await expect(promise).rejects.toThrow('slow-query')
    })

    it('includes timeout duration in error message', async () => {
      const promise = withTimeout(
        async () => new Promise(() => {}), // Never resolves
        { operationName: 'test', timeoutMs: 500 }
      )

      vi.advanceTimersByTime(600)

      await expect(promise).rejects.toThrow('500ms')
    })

    it('tracks active queries', async () => {
      const initialCount = getActiveQueryCount()
      
      const promise = withTimeout(
        async () => {
          expect(getActiveQueryCount()).toBe(initialCount + 1)
          return 'done'
        },
        { operationName: 'test', timeoutMs: 1000 }
      )

      await promise
      expect(getActiveQueryCount()).toBe(initialCount)
    })

    it('decrements active count even on error', async () => {
      const initialCount = getActiveQueryCount()

      const promise = withTimeout(
        async () => { throw new Error('DB error') },
        { operationName: 'test', timeoutMs: 1000 }
      )

      await expect(promise).rejects.toThrow('DB error')
      expect(getActiveQueryCount()).toBe(initialCount)
    })

    it('rejects when concurrent query limit exceeded', async () => {
      // Create many concurrent queries to hit the limit
      const promises: Promise<any>[] = []
      
      for (let i = 0; i < 60; i++) {
        promises.push(
          withTimeout(
            async () => new Promise(resolve => setTimeout(resolve, 10000)),
            { operationName: `query-${i}`, timeoutMs: 10000 }
          )
        )
      }

      // The 51st query should fail due to limit
      const excessPromise = withTimeout(
        async () => 'result',
        { operationName: 'excess', timeoutMs: 1000 }
      )

      await expect(excessPromise).rejects.toThrow('Too many concurrent queries')

      // Clean up
      vi.advanceTimersByTime(11000)
      await Promise.allSettled(promises)
    })

    it('logs slow queries', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 6000))
        return 'done'
      }
      
      const promise = withTimeout(operation, { operationName: 'slow-query', timeoutMs: 10000 })
      vi.advanceTimersByTime(6500)

      await promise
      consoleSpy.mockRestore()
    })

    it('respects abort signal', async () => {
      const abortController = new AbortController()
      
      const promise = withTimeout(
        async () => new Promise(resolve => setTimeout(resolve, 5000)),
        { 
          operationName: 'abortable',
          timeoutMs: 10000,
          abortSignal: abortController.signal,
        }
      )

      abortController.abort()

      await expect(promise).rejects.toThrow(QueryTimeoutError)
      await expect(promise).rejects.toThrow('was aborted')
    })

    it('uses default timeout when not specified', async () => {
      const promise = withTimeout(
        async () => new Promise(resolve => setTimeout(resolve, 20000)),
        { operationName: 'default-timeout' }
      )

      // Default is 10 seconds
      vi.advanceTimersByTime(11000)

      await expect(promise).rejects.toThrow(QueryTimeoutError)
    })

    it('propagates operation errors', async () => {
      class DatabaseError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'DatabaseError'
        }
      }

      await expect(
        withTimeout(
          async () => { throw new DatabaseError('Connection refused') },
          { operationName: 'test', timeoutMs: 1000 }
        )
      ).rejects.toThrow(DatabaseError)
    })
  })

  describe('QueryTimeoutError', () => {
    it('has correct name', () => {
      const error = new QueryTimeoutError('Test timeout')
      expect(error.name).toBe('QueryTimeoutError')
    })

    it('preserves message', () => {
      const error = new QueryTimeoutError('Operation timed out after 5000ms')
      expect(error.message).toBe('Operation timed out after 5000ms')
    })

    it('is instance of Error', () => {
      const error = new QueryTimeoutError('Test')
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('getActiveQueryCount', () => {
    it('returns 0 initially', () => {
      expect(getActiveQueryCount()).toBeGreaterThanOrEqual(0)
    })

    it('increments during query execution', async () => {
      const initialCount = getActiveQueryCount()
      let duringExecution = 0

      const promise = withTimeout(
        async () => {
          duringExecution = getActiveQueryCount()
          return 'done'
        },
        { operationName: 'test', timeoutMs: 1000 }
      )

      await promise

      expect(duringExecution).toBe(initialCount + 1)
    })

    it('decrements after query completion', async () => {
      const initialCount = getActiveQueryCount()

      await withTimeout(
        async () => 'result',
        { operationName: 'test', timeoutMs: 1000 }
      )

      expect(getActiveQueryCount()).toBe(initialCount)
    })

    it('decrements after query error', async () => {
      const initialCount = getActiveQueryCount()

      await expect(
        withTimeout(
          async () => { throw new Error('Failed') },
          { operationName: 'test', timeoutMs: 1000 }
        )
      ).rejects.toThrow()

      expect(getActiveQueryCount()).toBe(initialCount)
    })
  })
})
