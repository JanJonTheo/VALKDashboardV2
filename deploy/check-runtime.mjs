import Database from "better-sqlite3";

const database = new Database(":memory:");
const result = database.prepare("select 1 as value").get();
database.close();

if (result?.value !== 1) {
  throw new Error("Native SQLite runtime check failed");
}

console.log("Native SQLite runtime check passed");
