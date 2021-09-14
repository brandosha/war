type VueAppOptions<Data, Methods extends Record<string, (this: Data & Methods & Computed) => void>, Computed> = {
  data?: () => Data
  methods?: Methods
  computed: Computed
  [otherKey: string]: unknown
}

type Dictionary<T> = Record<string, T>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDictionary = Dictionary<any>

type _VueWatcher<Data, T> = ((this: VueApp<Data>, newVal?: T, oldVal?: T) => void) | {
  deep?: boolean,
  handler: (this: VueApp<Data>, newVal: T, oldVal: T) => void
} & AnyDictionary

declare class Vue {
  mount(el: string): this

  static createApp<Data>(options: {
    data?: () => Data
    methods?: {
      [key: string]: (this: VueApp<Data>, ...args: unknown[]) => unknown
    }
    computed?: {
      [key: string]: (this: VueApp<Data>, ...args: unknown[]) => unknown
    },
    watch?: {
      [key: string]: _VueWatcher<Data, unknown>
    },
    [otherKey: string]: unknown
  }): VueApp<Data>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

type VueApp<Data> = Data & Vue

interface Document {
  getElementById(id: string): HTMLElement
}

declare function testOpts<A, B>(options: {
  a: A,
  b: B,
  c: {
    [key: string]: (this: A & B) => void
  }
})

// interface Window {
//   app: Vue
// }