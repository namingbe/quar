import sourceMapSupport from "source-map-support"
sourceMapSupport.install(options)
import path from "path"
import { rimraf } from "rimraf"
import chalk from "chalk"
import { parseMarkdown } from "./processors/parse"
import { filterContent } from "./processors/filter"
import { emitContent } from "./processors/emit"
import { plugins } from "../quartz.config"
import { FilePath, joinSegments, slugifyFilePath } from "./util/path"
import { glob } from "./util/glob"
import { trace } from "./util/trace"
import { options } from "./util/sourcemap"
import { Argv } from "./cfg"

async function buildQuartz(argv: Argv) {
  console.time("all")
  const output = argv.output

  const pluginCount = Object.values(plugins).flat().length
  const pluginNames = (key: "transformers" | "filters" | "emitters") =>
    plugins[key].map((plugin) => plugin.name)
  if (argv.verbose) {
    console.log(`Loaded ${pluginCount} plugins`)
    console.log(`  Transformers: ${pluginNames("transformers").join(", ")}`)
    console.log(`  Filters: ${pluginNames("filters").join(", ")}`)
    console.log(`  Emitters: ${pluginNames("emitters").join(", ")}`)
  }

  // bro was timing rm -rf ? good lord
  console.time("clean")
  await rimraf(path.join(output, "*"), { glob: true })
  console.timeEnd("clean")

  console.time("glob")
  const allFiles = await glob("**/*.*", argv.directory, [])
  const fps = allFiles.filter((fp) => fp.endsWith(".md")).sort()
  console.log(`Found ${fps.length} input files from \`${argv.directory}\``)
  console.timeEnd("glob")

  const filePaths = fps.map((fp) => joinSegments(argv.directory, fp) as FilePath)
  const allSlugs = allFiles.map((fp) => slugifyFilePath(fp as FilePath))

  const parsedFiles = await parseMarkdown(argv, allSlugs, filePaths)
  const filteredContent = filterContent(argv, parsedFiles)

  await emitContent(argv, filteredContent)
  console.log(chalk.green(`Done processing ${fps.length} files`))
  console.timeEnd("all")
}

export default async (argv: Argv) => {
  try {
    return await buildQuartz(argv)
  } catch (err) {
    trace("\nExiting Quartz due to a fatal error", err as Error)
  }
}
