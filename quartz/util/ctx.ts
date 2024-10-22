export interface Argv {
  directory: string
  verbose: boolean
  output: string
  fastRebuild: boolean
  port: number
  wsPort: number
  remoteDevHost?: string
  concurrency?: number
}

