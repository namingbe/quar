import { PerfTimer } from "../util/perf"
import { getStaticResourcesFromPlugins } from "../plugins"
import { ProcessedContent } from "../plugins/vfile"
import { QuartzLogger } from "../util/log"
import { trace } from "../util/trace"
import cfg from "../../quartz.config"
import { Argv } from "../cfg"

export async function emitContent(argv: Argv, content: ProcessedContent[]) {
  const perf = new PerfTimer()
  const log = new QuartzLogger(argv.verbose)

  log.start(`Emitting output files`)

  let emittedFiles = 0
  const staticResources = getStaticResourcesFromPlugins(cfg)
  for (const emitter of cfg.plugins.emitters) {
    try {
      const emitted = await emitter.emit(argv, content, staticResources)
      emittedFiles += emitted.length

      if (argv.verbose) {
        for (const file of emitted) {
          console.log(`[emit:${emitter.name}] ${file}`)
        }
      }
    } catch (err) {
      trace(`Failed to emit from plugin \`${emitter.name}\``, err as Error)
    }
  }

  log.end(`Emitted ${emittedFiles} files to \`${argv.output}\` in ${perf.timeSince()}`)
}
