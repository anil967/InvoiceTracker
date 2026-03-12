/**
 * API Simulation Script
 * Simulates the hierarchy logic and logs the structure.
 * Run with: node scripts/simulate-api.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';

const MONGODB_URI = process.env.MONGODB_URI;

const ROLES = {
    ADMIN: 'Admin',
    PROJECT_MANAGER: 'PM',
    FINANCE_USER: 'Finance User',
    VENDOR: 'Vendor'
};

const UserSchema = new mongoose.Schema({
    id: String,
    email: String,
    role: String,
    name: String,
    managedBy: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function simulate() {
    try {
        await mongoose.connect(MONGODB_URI);
        const allUsers = await User.find({}).lean();
        
        const userMap = {};
        allUsers.forEach(u => { userMap[u.id] = { ...u, children: [] }; });

        const roots = [];
        const unassigned = [];

        allUsers.forEach(u => {
            const normalizedRole = u.role === 'ADMIN' ? ROLES.ADMIN :
                                 u.role === 'PM' ? ROLES.PROJECT_MANAGER :
                                 u.role === 'PROJECT_MANAGER' ? ROLES.PROJECT_MANAGER :
                                 u.role === 'FINANCE_USER' ? ROLES.FINANCE_USER :
                                 u.role === 'VENDOR' ? ROLES.VENDOR : u.role;
            
            const node = userMap[u.id];
            node.role = normalizedRole;

            if (normalizedRole === ROLES.ADMIN) {
                roots.push(node);
            } else if (u.managedBy && userMap[u.managedBy]) {
                userMap[u.managedBy].children.push(node);
            } else {
                unassigned.push(node);
            }
        });

        const output = {
            rootsCount: roots.length,
            unassignedCount: unassigned.length,
            roots: roots.map(r => ({ id: r.id, name: r.name, role: r.role, childrenCount: r.children.length })),
            unassigned: unassigned.map(u => ({ id: u.id, name: u.name, role: u.role }))
        };

        fs.writeFileSync('api-sim-log.json', JSON.stringify(output, null, 2));
        console.log('✅ Simulation complete. Check api-sim-log.json');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

simulate();
