const LATENCY = 600

export function delay(ms: number = LATENCY) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export async function mockRequest<T>(data: T, ms: number = LATENCY): Promise<T> {
  await delay(ms)
  return data
}

export async function mockMutation<T>(
  factory: () => T,
  ms: number = LATENCY
): Promise<T> {
  await delay(ms)
  return factory()
}

export function makeReference(prefix: string) {
  return `${prefix}-${Math.floor(10000000 + Math.random() * 99999999)}`
}