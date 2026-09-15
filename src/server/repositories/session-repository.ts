import type { Database } from "@/server/adapters/database";

export type SessionRecord = {
  id: string;
  expiresAt: Date;
};

type SessionRow = {
  id: string;
  expires_at: Date;
};

export class SessionRepository {
  constructor(private readonly database: Database) {}

  async create(session: SessionRecord): Promise<void> {
    await this.database.query(
      "INSERT INTO sessions (id, expires_at) VALUES ($1, $2)",
      [session.id, session.expiresAt],
    );
  }

  async findActive(id: string, now: Date): Promise<SessionRecord | null> {
    const result = await this.database.query<SessionRow>(
      "SELECT id, expires_at FROM sessions WHERE id = $1 AND expires_at > $2",
      [id, now],
    );
    const session = result.rows[0];
    return session ? { id: session.id, expiresAt: session.expires_at } : null;
  }

  async delete(id: string): Promise<void> {
    await this.database.query("DELETE FROM sessions WHERE id = $1", [id]);
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.database.query("DELETE FROM sessions WHERE expires_at <= $1", [now]);
    return result.rowCount ?? 0;
  }
}
