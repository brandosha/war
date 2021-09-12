type Dictionary<T> = Record<string, T>

const dbCache: Dictionary<string>  = {}

interface Database {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

let database: Database = {
  async get(key) {
    return dbCache[key]
  },
  async set(key, value) {
    dbCache[key] = value
  }
}

if (process.env.REPLDB) {
  database = {
    async get() {
      return "not yet implemented"
    },
    async set() {
      return
    }
  }
}

export const db = database