import { api } from "@/lib/api/http"
import { mapUser, type RawUser } from "@/lib/api/mappers"
import type { User } from "@/types"

export async function apiUpdateAvatar(file: File): Promise<User> {
  const formData = new FormData()
  formData.append("file", file)
  const { data } = await api.upload<RawUser>("/api/users/me/avatar", formData)
  return mapUser(data)
}

export async function apiRemoveAvatar(): Promise<User> {
  const { data } = await api.delete<RawUser>("/api/users/me/avatar")
  return mapUser(data)
}