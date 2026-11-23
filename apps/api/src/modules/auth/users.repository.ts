import type { Queryable } from '@vidcraft/shared/server';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  created_at: Date;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  passwordHash: r.password_hash,
  firstName: r.first_name,
  lastName: r.last_name,
  createdAt: r.created_at,
});

export class UsersRepository {
  constructor(private readonly db: Queryable) {}

  /** Returns null if the email is already taken. */
  async create(user: Omit<User, 'id' | 'createdAt'>): Promise<User | null> {
    const { rows } = await this.db.query<UserRow>(
      `insert into users (email, password_hash, first_name, last_name) values ($1, $2, $3, $4)
       on conflict (email) do nothing returning *`,
      [user.email, user.passwordHash, user.firstName, user.lastName],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.db.query<UserRow>('select * from users where email = $1', [email]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.db.query<UserRow>('select * from users where id = $1', [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }
}
