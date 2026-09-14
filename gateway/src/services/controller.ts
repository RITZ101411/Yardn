const CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://localhost:3000'

export class ControllerError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

export async function requestController<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${CONTROLLER_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ControllerError('controller unreachable', 502)
  }

  const text = await response.text()
  let payload: unknown
  try {
    payload = text ? JSON.parse(text) : undefined
  } catch {
    payload = undefined
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : `controller returned ${response.status}`
    throw new ControllerError(message, response.status)
  }
  return payload as T
}
