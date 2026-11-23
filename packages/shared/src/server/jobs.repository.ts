import type pg from 'pg';
import type { JobStatus, JobTask } from '../index.ts';

export interface Job {
  id: string;
  userId: string | null;
  task: JobTask;
  status: JobStatus;
  progress: number;
  inputName: string;
  inputSize: number;
  inputKey: string;
  outputKey: string | null;
  outputSize: number | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

/** Anything that can run a query: the pool or a client inside a transaction. */
export type Queryable = Pick<pg.Pool, 'query'>;

interface JobRow {
  id: string;
  user_id: string | null;
  operation: JobTask['operation'];
  params: JobTask['params'];
  status: JobStatus;
  progress: number;
  input_name: string;
  input_size: string; // bigint comes back as a string
  input_key: string;
  output_key: string | null;
  output_size: string | null;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
}

const toJob = (r: JobRow): Job => ({
  id: r.id,
  userId: r.user_id,
  task: { operation: r.operation, params: r.params } as JobTask,
  status: r.status,
  progress: r.progress,
  inputName: r.input_name,
  inputSize: Number(r.input_size),
  inputKey: r.input_key,
  outputKey: r.output_key,
  outputSize: r.output_size === null ? null : Number(r.output_size),
  error: r.error,
  createdAt: r.created_at,
  completedAt: r.completed_at,
});

export class JobsRepository {
  constructor(private readonly db: Queryable) {}

  async create(job: Pick<Job, 'id' | 'userId' | 'task' | 'inputName' | 'inputSize' | 'inputKey'>): Promise<Job> {
    const { rows } = await this.db.query<JobRow>(
      `insert into jobs (id, user_id, operation, params, input_name, input_size, input_key)
       values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [job.id, job.userId, job.task.operation, job.task.params, job.inputName, job.inputSize, job.inputKey],
    );
    return toJob(rows[0]!);
  }

  async findById(id: string): Promise<Job | null> {
    const { rows } = await this.db.query<JobRow>('select * from jobs where id = $1', [id]);
    return rows[0] ? toJob(rows[0]) : null;
  }

  async listByUser(userId: string, limit = 50): Promise<Job[]> {
    const { rows } = await this.db.query<JobRow>(
      'select * from jobs where user_id = $1 order by created_at desc limit $2',
      [userId, limit],
    );
    return rows.map(toJob);
  }

  /**
   * Moves a job from `from` to `to`. Returns false if the job was not in `from`,
   * so two callers can never both win the same transition.
   */
  async transition(id: string, from: JobStatus, to: JobStatus, db: Queryable = this.db): Promise<boolean> {
    const { rowCount } = await db.query(
      'update jobs set status = $3, updated_at = now() where id = $1 and status = $2',
      [id, from, to],
    );
    return rowCount === 1;
  }

  async setProgress(id: string, progress: number): Promise<void> {
    await this.db.query('update jobs set progress = $2, updated_at = now() where id = $1', [id, progress]);
  }

  async complete(id: string, outputKey: string, outputSize: number): Promise<void> {
    await this.db.query(
      `update jobs set status = 'completed', progress = 100, output_key = $2, output_size = $3,
         error = null, completed_at = now(), updated_at = now() where id = $1`,
      [id, outputKey, outputSize],
    );
  }

  async fail(id: string, error: string): Promise<void> {
    await this.db.query(
      `update jobs set status = 'failed', error = $2, updated_at = now() where id = $1`,
      [id, error.slice(0, 1000)],
    );
  }
}
