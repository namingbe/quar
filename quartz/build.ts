import sourceMapSupport from "source-map-support"
sourceMapSupport.install(options)
import path from "path"
import { PerfTimer } from "./util/perf"
import { rimraf } from "rimraf"
import chalk from "chalk"
import { parseMarkdown } from "./processors/parse"
import { filterContent } from "./processors/filter"
import { emitContent } from "./processors/emit"
import cfg from "../quartz.config"
import { FilePath, joinSegments, slugifyFilePath } from "./util/path"
import { glob } from "./util/glob"
import { trace } from "./util/trace"
import { options } from "./util/sourcemap"
import { Mutex } from "async-mutex"
import { Argv } from "./cfg"

async function buildQuartz(argv: Argv, mut: Mutex) {
  const perf = new PerfTimer()
  const output = argv.output

  const pluginCount = Object.values(cfg.plugins).flat().length
  const pluginNames = (key: "transformers" | "filters" | "emitters") =>
    cfg.plugins[key].map((plugin) => plugin.name)
  if (argv.verbose) {
    console.log(`Loaded ${pluginCount} plugins`)
    console.log(`  Transformers: ${pluginNames("transformers").join(", ")}`)
    console.log(`  Filters: ${pluginNames("filters").join(", ")}`)
    console.log(`  Emitters: ${pluginNames("emitters").join(", ")}`)
  }

  const release = await mut.acquire()
  perf.addEvent("clean")
  await rimraf(path.join(output, "*"), { glob: true })
  console.log(`Cleaned output directory \`${output}\` in ${perf.timeSince("clean")}`)

  perf.addEvent("glob")
  const allFiles = await glob("**/*.*", argv.directory, cfg.configuration.ignorePatterns)
  const fps = allFiles.filter((fp) => fp.endsWith(".md")).sort()
  console.log(
    `Found ${fps.length} input files from \`${argv.directory}\` in ${perf.timeSince("glob")}`,
  )

  const filePaths = fps.map((fp) => joinSegments(argv.directory, fp) as FilePath)
  const allSlugs = allFiles.map((fp) => slugifyFilePath(fp as FilePath))

  const parsedFiles = await parseMarkdown(argv, cfg, allSlugs, filePaths)
  const filteredContent = filterContent(argv, cfg, parsedFiles)

  await emitContent(argv, cfg, filteredContent)
  console.log(chalk.green(`Done processing ${fps.length} files in ${perf.timeSince()}`))
  release()
}

export default async (argv: Argv, mut: Mutex) => {
  try {
    return await buildQuartz(argv, mut)
  } catch (err) {
    trace("\nExiting Quartz due to a fatal error", err as Error)
  }
}
