import type * as SQLite from "expo-sqlite";
import { getDb } from "./client";

/**
 * Serializes every transaction in the app onto one chain.
 *
 * expo-sqlite hands out a single shared connection and SQLite has no nested
 * transactions. Two overlapping transactions therefore either fail the second
 * `BEGIN` with an opaque driver error, or let one function's `ROLLBACK` discard
 * rows the other had already committed. Awaiting the previous task before
 * starting the next removes both outcomes.
 *
 * A rejected task must not poison the chain, so the queue advances on failure
 * as well. The caller still receives the rejection.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

async function withTransaction<T>(
  db: SQLite.SQLiteDatabase,
  task: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  // withTransactionAsync resolves only after COMMIT and rethrows otherwise, so
  // a collected entry means the task committed. Using an array avoids asserting
  // on a value the compiler cannot see being assigned inside the callback.
  const collected: T[] = [];

  await db.withTransactionAsync(async () => {
    collected.push(await task(db));
  });

  if (collected.length === 0) {
    throw new Error("Transaction committed without producing a result");
  }

  return collected[0];
}

export function runInTransaction<T>(
  task: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const result = writeQueue.then(async () => withTransaction(await getDb(), task));

  writeQueue = result.then(
    () => undefined,
    () => undefined
  );

  return result;
}

/**
 * For migrations that run inside `getDb` before the connection is published.
 * They already hold the handle and cannot join the queue without deadlocking,
 * and nothing else can be running yet, so they are serialized by construction.
 * Every other caller passes no database and queues normally.
 */
export function runInTransactionOn<T>(
  database: SQLite.SQLiteDatabase | undefined,
  task: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  return database ? withTransaction(database, task) : runInTransaction(task);
}
