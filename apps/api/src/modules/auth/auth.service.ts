import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { LoginRequest, RegisterRequest, UserDto } from '@vidcraft/shared';
import { HttpError } from '../../http/errors.ts';
import type { User, UsersRepository } from './users.repository.ts';

const BCRYPT_ROUNDS = 12;
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

// Compared against when the email doesn't exist, so a login takes the same time either way
// and response timing can't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', BCRYPT_ROUNDS);

export const toUserDto = (u: User): UserDto => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  createdAt: u.createdAt.toISOString(),
});

export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwtSecret: string,
  ) {}

  async register(input: RegisterRequest): Promise<{ user: User; token: string }> {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    });
    if (!user) throw new HttpError(409, 'email_taken', 'An account with this email already exists');
    return { user, token: this.issueToken(user.id) };
  }

  async login(input: LoginRequest): Promise<{ user: User; token: string }> {
    const user = await this.users.findByEmail(input.email);
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'invalid_credentials', 'Invalid email or password');
    return { user, token: this.issueToken(user.id) };
  }

  getUser(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  /** Returns the user id, or null for a missing, expired or tampered token. */
  verifyToken(token: string): string | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] });
      return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }

  private issueToken(userId: string): string {
    return jwt.sign({}, this.jwtSecret, { subject: userId, expiresIn: SESSION_TTL_SECONDS, algorithm: 'HS256' });
  }
}
