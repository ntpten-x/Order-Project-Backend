import { AppDataSource, connectDatabase } from "./database/database";
import { Users } from "./entity/Users";
import { Roles } from "./entity/Roles";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from 'uuid';

const seed = async () => {
    await connectDatabase();

    const roleRepo = AppDataSource.getRepository(Roles);
    const userRepo = AppDataSource.getRepository(Users);

    // 1. Ensure Roles
    const roles = ["admin", "manager", "employee"];
    const roleMap: Record<string, Roles> = {};

    for (const r of roles) {
        let role = await roleRepo.findOne({ where: { roles_name: r } });
        if (!role) {
            console.log(`Creating role: ${r}`);
            role = new Roles();
            role.roles_name = r;
            role.display_name = r.charAt(0).toUpperCase() + r.slice(1);
            await roleRepo.save(role);
        }
        roleMap[r] = role;
    }

    // 2. Ensure Users
    const users = [
        { username: "admin", role: "admin" },
        { username: "manager", role: "manager" },
        { username: "employee", role: "employee" },
        { username: "banned", role: "employee", is_use: false }
    ];

    for (const u of users) {
        let user = await userRepo.findOne({ where: { username: u.username } });
        if (!user) {
            console.log(`Creating user: ${u.username}`);
            user = new Users();
            user.username = u.username;
            // Hash password
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash("password", salt);
            user.roles = roleMap[u.role];
            user.is_use = u.is_use !== undefined ? u.is_use : true;
            user.is_active = false;
            await userRepo.save(user);
        } else {
            // Ensure checking password matches 'password' logic might be needed if you want to test login, 
            // but we won't overwrite existing users' passwords to avoid data loss.
            // We'll assume if we created them, they are 'password'.
            console.log(`User ${u.username} already exists`);
        }
    }

    console.log("Seed complete. Test users: admin/password, manager/password, employee/password, banned/password");
    process.exit(0);
};

seed();
