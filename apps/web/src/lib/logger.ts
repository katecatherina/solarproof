const SENSITIVE = /key|secret|token|password|sig|hex|private/i

export function redact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (SENSITIVE.test(k)) return [k, '[REDACTED]']
      if (v !== null && typeof v === 'object' && !Array.isArray(v))
        return [k, redact(v as Record<string, unknown>)]
      return [k, v]
    })
  )
}

function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: Record<string, unknown>) {
  const entry = JSON.stringify({ level, message, ...(meta ? redact(meta) : {}), ts: new Date().toISOString() })
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.log(entry)
}

export const logger = {
  info:  (message: string, meta?: Record<string, unknown>) => log('info',  message, meta),
  warn:  (message: string, meta?: Record<string, unknown>) => log('warn',  message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
}
