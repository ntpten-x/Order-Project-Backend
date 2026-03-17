import { Users } from "../entity/Users";

export type SafeUser = Omit<Users, "password">;

export function sanitizeUser<T extends Partial<Users> | null | undefined>(user: T): T extends null | undefined ? T : SafeUser {
    if (!user) {
        return user as T extends null | undefined ? T : SafeUser;
    }

    const { password: _password, ...safeUser } = user as Users;
    return safeUser as T extends null | undefined ? T : SafeUser;
}

export function sanitizeUsers<T extends Partial<Users>>(users: T[]): SafeUser[] {
    return users.map((user) => sanitizeUser(user as Users));
}

