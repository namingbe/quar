import { PerfTimer } from "../util/perf"
import { ProcessedContent } from "../plugins/vfile"
import { plugins } from "../../quartz.config"
import { Argv } from "../cfg"

export function filterContent(argv: Argv, content: ProcessedContent[]): ProcessedContent[] {
  const perf = new PerfTimer()
  const initialLength = content.length
  for (const plugin of plugins.filters) {
    const updatedContent = content.filter((item) => plugin.shouldPublish(item))

    if (argv.verbose) {
      const diff = content.filter((x) => !updatedContent.includes(x))
      for (const file of diff) {
        console.log(`[filter:${plugin.name}] ${file[1].data.slug}`)
      }
    }

    content = updatedContent
  }

  console.log(`Filtered out ${initialLength - content.length} files in ${perf.timeSince()}`)
  return content
}
