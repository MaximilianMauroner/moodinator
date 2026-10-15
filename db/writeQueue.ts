import type * as SQLite from "expo-sqlite";
import { openDatabase, type InitDb, type QueryConnection } from "./client";

declare const queued: unique symbol;
type Queued = { readonly [queued]: true };

/**
 * The connection inside one transaction. Only withTransaction creates one, so
 * a function that takes a WriteTx cannot run outside a transaction.
 */
export type WriteTx = QueryConnection
  & Pick<SQLite.SQLiteDatabase, "runAsync" | "execAsync">
  & Queued;

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
  db: SQLite.SQLiteDatabase | InitDb,
  task: (tx: WriteTx) => Promise<T>
): Promise<T> {
  const tx: WriteTx = db as typeof db & Queued;
  // withTransactionAsync resolves only after COMMIT and rethrows otherwise, so
  // a collected entry means the task committed. Using an array avoids asserting
  // on a value the compiler cannot see being assigned inside the callback.
  const collected: T[] = [];

  await db.withTransactionAsync(async () => {
    collected.push(await task(tx));
  });

  if (collected.length === 0) {
    throw new Error("Transaction committed without producing a result");
  }

  return collected[0];
}

export function runInTransaction<T>(
  task: (tx: WriteTx) => Promise<T>
): Promise<T> {
  const result = writeQueue.then(async () => withTransaction(await openDatabase(), task));

  writeQueue = result.then(
    () => undefined,
    () => undefined
  );

  return result;
}

/**
 * For initialization, which runs inside openDatabase before the connection is
 * published. It cannot join the queue without deadlocking, and nothing else
 * can be running yet, so it is serialized by construction.
 */
export function runInitTransaction<T>(
  init: InitDb,
  task: (tx: WriteTx) => Promise<T>
): Promise<T> {
  return withTransaction(init, task);
}
