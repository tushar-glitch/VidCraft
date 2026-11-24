import type pg from 'pg';
import type { Queryable } from '@vidcraft/shared/server';

/** Puts a message on a queue using the given connection, so it can join a transaction. */
export type Enqueue = (queue: string, data: object, db: Queryable) => Promise<void>;

/** Runs `fn` in a transaction: commits if it resolves, rolls back if it throws. */
export async function inTransaction<T>(pool: pg.Pool, fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
