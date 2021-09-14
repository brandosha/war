type VueAppOptions<Data, Methods extends Record<string, (this: Data & Methods & Computed) => void>, Computed> = {
  data?: () => Data
  methods?: Methods
  computed: Computed
  [otherKey: string]: unknown
}

declare class Vue {
  mount(el: string): this

  static createApp<Data, Methods extends Record<string, (this: VueApp<Data & Methods & Computed>, ...args: unknown[]) => void>, Computed extends Record<string, (this: VueApp<Data & Methods & Computed>, ...args: unknown[]) => unknown>, Watchers extends Record<string, (this: VueApp<Data & Methods & Computed>, ...args: unknown[]) => void>>(options: {
    data?: () => Data
    methods?: Methods
    computed?: Computed,
    watch?: Watchers,
    [otherKey: string]: unknown
  }): VueApp<Data & Methods & Computed>
}

type VueApp<Data> = Data & Vue

interface Document {
  getElementById(id: string): HTMLElement
}

// interface Window {
//   app: Vue
// }