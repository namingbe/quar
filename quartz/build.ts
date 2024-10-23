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

  if (argv.verbose) {
    console.log(`Loaded ${Object.values(plugins).flat().length} plugins`)
    for (const type of ["transformers", "filters", "emitters"] as const) {
      console.log(`  ${type}: ${plugins[type].map(plugin => plugin.name).join(", ")}`)
    }
  }

  // rm -rf output/*, but using a whole separate dependency?
  await rimraf(path.join(argv.output, "*"), { glob: true })

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
