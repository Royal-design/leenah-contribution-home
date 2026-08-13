import type { Role, User } from "@/types"

export function hasRole(user: User | null, role: Role): boolean {
  if (!user) {
    return false
  }
  if (user.roles?.length) {
    return user.roles.includes(role)
  }
  return user.role === role
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, "admin")
}

export function roleLabel(user: User | null): string {
  if (!user) {
    return ""
  }
  const roles = user.roles?.length
    ? user.roles
    : user.role === "admin"
      ? ["user", "admin"]
      : ["user"]
  return roles
    .sort((a, b) => (a === "admin" ? -1 : 1))
    .map((role) => (role === "admin" ? "Admin" : "User"))
    .join(" · ")
}