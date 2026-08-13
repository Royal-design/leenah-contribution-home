import axios, { AxiosError, type AxiosRequestConfig } from "axios"
import { toast } from "sonner"

import {
  clearStoredSession,
  getStoredTokens,
  updateStoredTokens,
} from "@/lib/api/session"
import { ApiError, type ApiEnvelope, type ApiResult } from "@/lib/api/types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"

const http = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  paramsSerializer: {
    serialize(params) {
      const searchParams = new URLSearchParams()
      Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          return
        }
        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item !== null && item !== undefined && item !== "") {
              searchParams.append(key, String(item))
            }
          })
        } else {
          searchParams.append(key, String(value))
        }
      })
      return searchParams.toString()
    },
  },
})

http.interceptors.request.use((config) => {
  const { accessToken } = getStoredTokens()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null
let expiryNotified = false
let refreshTransientFailure = false

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getStoredTokens()
  if (!refreshToken) {
    return null
  }
  if (refreshPromise) {
    return refreshPromise
  }
  refreshPromise = (async () => {
    try {
      const { data } = await axios.post<ApiEnvelope<{
        access_token: string
        refresh_token: string
      }>>(`${API_BASE}/api/auth/refresh`, {
        refresh_token: refreshToken,
      })
      const payload = data.data
      if (!payload) {
        clearStoredSession()
        refreshTransientFailure = false
        return null
      }
      updateStoredTokens(payload.access_token, payload.refresh_token)
      expiryNotified = false
      refreshTransientFailure = false
      return payload.access_token
    } catch (error) {
      const isDefinitive =
        error instanceof AxiosError && error.response?.status !== undefined
      if (isDefinitive) {
        clearStoredSession()
        refreshTransientFailure = false
      } else {
        refreshTransientFailure = true
      }
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

function toApiError(error: AxiosError<ApiEnvelope<unknown>>): ApiError {
  const payload = error.response?.data
  const status = error.response?.status
  return new ApiError(
    payload?.message ??
      error.response?.statusText ??
      error.message ??
      "Something went wrong",
    payload?.error_code ??
      (status ? `HTTP_${status}` : "NETWORK_ERROR"),
    status,
    payload?.details ?? undefined
  )
}

async function forceSessionExpiry(): Promise<void> {
  if (typeof window === "undefined") {
    return
  }

  const { useAuthStore } = await import("@/stores/auth-store")
  useAuthStore.getState().expireSession()

  if (expiryNotified) {
    return
  }
  expiryNotified = true

  const alreadyOnLogin = window.location.pathname.startsWith("/login")
  if (!alreadyOnLogin) {
    toast.error("Session expired", {
      description: "Your session has timed out. Please sign in again to continue.",
    })
    window.location.assign("/login")
  }
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined
    const status = error.response?.status
    const isAuthUrl = original?.url?.includes("/api/auth/") ?? false

    if (status === 401 && original && !original._retry && !isAuthUrl) {
      original._retry = true
      const token = await refreshAccessToken()
      if (token) {
        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${token}`,
        }
        return http(original)
      }
    }

    if (
      status === 401 &&
      original &&
      !isAuthUrl &&
      !refreshTransientFailure
    ) {
      await forceSessionExpiry()
    }

    throw toApiError(error)
  }
)

async function request<T>(config: AxiosRequestConfig): Promise<ApiResult<T>> {
  const response = await http.request<ApiEnvelope<T> | T>(config)
  const payload = response.data as ApiEnvelope<T>

  if (payload && typeof payload === "object" && "success" in payload) {
    return {
      data: payload.data as T,
      message: payload.message,
    }
  }

  return { data: payload as T }
}

export { http }

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    request<T>({ method: "GET", url, params }),
  post: <T>(url: string, body?: unknown) =>
    request<T>({ method: "POST", url, data: body }),
  put: <T>(url: string, body?: unknown) =>
    request<T>({ method: "PUT", url, data: body }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>({ method: "PATCH", url, data: body }),
  delete: <T>(url: string) => request<T>({ method: "DELETE", url }),
  upload: <T>(url: string, formData: FormData) =>
    request<T>({ method: "POST", url, data: formData }),
}