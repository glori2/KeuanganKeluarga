import postgres from 'postgres';

let _sql: postgres.Sql | null = null;

function getSql(): postgres.Sql {
  if (!_sql) {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/postgres';

    _sql = postgres(connectionString, {
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return _sql;
}

// Create a callable proxy so `sql` can be called as a tagged template literal, function, or property access (e.g. sql.begin)
const sql = new Proxy(function () {} as unknown as postgres.Sql, {
  apply(_target, _thisArg, argArray) {
    const client = getSql();
    return Reflect.apply(client as unknown as Function, client, argArray);
  },
  get(_target, prop, receiver) {
    const client = getSql();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export default sql;
