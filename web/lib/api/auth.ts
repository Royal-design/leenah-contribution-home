import { api } from "@/lib/api/http"
import { mapUser, type RawUser } from "@/lib/api/mappers"
import type { User } from "@/types"

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
}

export interface AuthResult {
  user: User
  accessToken: string
  refreshToken: string
}

export interface UpdateProfilePayload {
  firstName?: string
  lastName?: string
  phone?: string
}

interface RawAuthResponse {
  user: RawUser
  access_token: string
  refresh_token: string
  token_type: string
}

interface RawTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export async function apiLogin(payload: LoginPayload): Promise<AuthResult> {
  const { data } = await api.post<RawAuthResponse>("/api/auth/login", payload)
  return {
    user: mapUser(data.user),
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  }
}

export async function apiGoogleLogin(accessToken: string): Promise<AuthResult> {
  const { data } = await api.post<RawAuthResponse>("/api/auth/google", {
    access_token: accessToken,
  })
  return {
    user: mapUser(data.user),
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  }
}

export async function apiRegister(payload: RegisterPayload): Promise<AuthResult> {
  const { data } = await api.post<RawAuthResponse>("/api/auth/register", {
    first_name: payload.firstName,
    last_name: payload.lastName,
    email: payload.email,
    phone: payload.phone,
    password: payload.password,
  })
  return {
    user: mapUser(data.user),
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  }
}

export async function apiRefresh(refreshToken: string): Promise<RawTokenResponse> {
  const { data } = await api.post<RawTokenResponse>("/api/auth/refresh", {
    refresh_token: refreshToken,
  })
  return data
}

export async function apiLogout(refreshToken: string): Promise<void> {
  await api.post("/api/auth/logout", { refresh_token: refreshToken })
}

export async function apiGetCurrentUser(): Promise<User> {
  const { data } = await api.get<RawUser>("/api/auth/me")
  return mapUser(data)
}

export async function apiUpdateProfile(payload: UpdateProfilePayload): Promise<User> {
  const { data } = await api.patch<RawUser>("/api/auth/me", {
    first_name: payload.firstName,
    last_name: payload.lastName,
    phone: payload.phone,
  })
  return mapUser(data)
}

export async function apiChangePassword(payload: ChangePasswordPayload): Promise<void> {
  await api.patch("/api/auth/me/password", {
    current_password: payload.currentPassword,
    new_password: payload.newPassword,
  })
}

export async function apiDeleteAccount(): Promise<void> {
  await api.delete("/api/auth/me")
}

export async function apiRequestPasswordReset(email: string): Promise<void> {
  await api.post("/api/auth/password-reset/request", { email })
}

export async function apiConfirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await api.post("/api/auth/password-reset/confirm", { token, new_password: newPassword })
}