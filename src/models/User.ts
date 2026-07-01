import bcrypt from 'bcrypt';
import db from '../config/database';

const SALT_ROUNDS = 12;

export type UserRole = 'Admin' | 'Stakeholder' | 'Teacher';

export interface User {
  id: string;
  organization_id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export const UserModel = {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  },

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  async findByEmail(email: string, organizationId: string): Promise<User | null> {
    const user = await db<User>('users')
      .whereRaw('LOWER(email) = LOWER(?)', [email.trim()])
      .where({ organization_id: organizationId })
      .first();
    return user || null;
  },

  async findById(id: string): Promise<User | null> {
    const user = await db<User>('users')
      .where({ id })
      .first();
    return user || null;
  },

  async create(data: {
    email: string;
    password: string;
    organizationId: string;
    role: string;
  }): Promise<User> {
    const passwordHash = await this.hashPassword(data.password);

    const [user] = await db<User>('users')
      .insert({
        email: data.email,
        password_hash: passwordHash,
        organization_id: data.organizationId,
        role: data.role as UserRole,
      })
      .returning('*');

    return user;
  },
};
