type RoleCheck = { roleName?: string };

export function isOwner(session: RoleCheck) {
  return session.roleName === "owner";
}

export function canManageUsers(session: RoleCheck) {
  return session.roleName === "owner";
}

export function canAccessSettings(session: RoleCheck) {
  return session.roleName === "owner";
}

export function canAccessBackup(session: RoleCheck) {
  return session.roleName === "owner";
}
export function canVoidOrSettle(session: RoleCheck) {
  return session.roleName === "owner" || session.roleName === "accountant";
}