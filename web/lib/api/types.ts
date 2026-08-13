export interface QueryParams {
  page?: number
  pageSize?: number
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * The `data` payload shape used by every paginated LCH list endpoint.
 * Pagination lives INSIDE `data` (the envelope `meta` is always null).
 */
export interface ListPayload<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface ApiEnvelope<T> {
  success: boolean
  message: string
  data?: T
  error_code?: string | null
  details?: Record<string, string[]> | string | null
}

export interface ApiResult<T> {
  data: T
  message?: string
}

export class ApiError extends Error {
  code: string
  status?: number
  details?: Record<string, string[]> | string

  constructor(
    message: string,
    code = "UNKNOWN_ERROR",
    status?: number,
    details?: Record<string, string[]> | string
  ) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
    this.details = details
  }
}

export function toPaginated<T>(
  items: T[],
  meta?: { total?: number; page?: number; page_size?: number; pages?: number },
  pageSize = 20
): Paginated<T> {
  const total = meta?.total ?? items.length
  const totalPages =
    meta?.pages ?? Math.max(1, Math.ceil(total / Math.max(1, meta?.page_size ?? pageSize)))
  return {
    items,
    page: meta?.page ?? 1,
    pageSize: meta?.page_size ?? pageSize,
    total,
    totalPages,
  }
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof Error) {
    return error.message && error.message !== "Request failed with status code 401"
      ? error.message
      : fallback
  }
  return fallback
}