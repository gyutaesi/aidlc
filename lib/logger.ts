type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

interface LogMeta {
  [key: string]: unknown
}

function log(level: LogLevel, message: string, meta?: LogMeta): void {
  const entry = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  })

  switch (level) {
    case 'ERROR':
      console.error(entry)
      break
    case 'WARN':
      console.warn(entry)
      break
    default:
      console.log(entry)
  }
}

export const logger = {
  debug: (message: string, meta?: LogMeta) => log('DEBUG', message, meta),
  info: (message: string, meta?: LogMeta) => log('INFO', message, meta),
  warn: (message: string, meta?: LogMeta) => log('WARN', message, meta),
  error: (message: string, meta?: LogMeta) => log('ERROR', message, meta),
}
