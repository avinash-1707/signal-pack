import { attachDatabasePool } from "@vercel/functions";
import { Pool, type QueryResultRow } from "pg";

export type Database = {
  query<Row extends QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rowCount: number | null; rows: Row[] }>;
};

let pool: Pool | undefined;

function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  pool = new Pool({ connectionString });
  attachDatabasePool(pool);
  return pool;
}

export const database: Database = {
  async query<Row extends QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ) {
    return getPool().query<Row>(text, [...values]);
  },
};
