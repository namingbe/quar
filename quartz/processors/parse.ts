import esbuild from "esbuild"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { Processor, unified } from "unified"
import { Root as MDRoot } from "remark-parse/lib"
import { Root as HTMLRoot } from "hast"
import { ProcessedContent } from "../plugins/vfile"
import { read } from "to-vfile"
import { FilePath, FullSlug, QUARTZ, slugifyFilePath } from "../util/path"
import path from "path"
import workerpool, { Promise as WorkerPromise } from "workerpool"
import { QuartzLogger } from "../util/log"
import { trace } from "../util/trace"
import { plugins } from "../../quartz.config"
import { Argv } from "../cfg"

export type QuartzProcessor = Processor<MDRoot, MDRoot, HTMLRoot>
export function createProcessor(allSlugs: FullSlug[]): QuartzProcessor {
  const transformers = plugins.transformers

  return (
    unified()
      // base Markdown -> MD AST
      .use(remarkParse)
      // MD AST -> MD AST transforms
      .use(
        transformers
          .filter((p) => p.markdownPlugins)
          .flatMap((plugin) => plugin.markdownPlugins!()),
      )
      // MD AST -> HTML AST
      .use(remarkRehype, { allowDangerousHtml: true })
      // HTML AST -> HTML AST transforms
      .use(transformers.filter((p) => p.htmlPlugins).flatMap((plugin) => plugin.htmlPlugins!(allSlugs)))
  )
}

function* chunks<T>(arr: T[], n: number) {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n)
  }
}

async function transpileWorkerScript() {
  // transpile worker script
  const cacheFile = "./.quartz-cache/transpiled-worker.mjs"
  const fp = "./quartz/worker.ts"
  return esbuild.build({
    entryPoints: [fp],
    outfile: path.join(QUARTZ, cacheFile),
    bundle: true,
    keepNames: true,
    platform: "node",
    format: "esm",
    packages: "external",
    sourcemap: true,
    sourcesContent: false,
    plugins: [
      {
        name: "css-and-scripts-as-text",
        setup(build) {
          build.onLoad({ filter: /\.scss$/ }, (_) => ({
            contents: "",
            loader: "text",
          }))
          build.onLoad({ filter: /\.inline\.(ts|js)$/ }, (_) => ({
            contents: "",
            loader: "text",
          }))
        },
      },
    ],
  })
}

export function createFileParser(argv: Argv, fps: FilePath[]) {
  return async (processor: QuartzProcessor) => {
    const res: ProcessedContent[] = []
    for (const fp of fps) {
      try {
        if (argv.verbose) { console.time(`${fp}`) }
        const file = await read(fp)

        // strip leading and trailing whitespace
        file.value = file.value.toString().trim()

        // Text -> Text transforms
        for (const plugin of plugins.transformers.filter((p) => p.textTransform)) {
          file.value = plugin.textTransform!(file.value.toString())
        }

        // base data properties that plugins may use
        file.data.filePath = file.path as FilePath
        file.data.relativePath = path.posix.relative(argv.directory, file.path) as FilePath
        file.data.slug = slugifyFilePath(file.data.relativePath)

        const ast = processor.parse(file)
        const newAst = await processor.run(ast, file)
        res.push([newAst, file])

        if (argv.verbose) {
          console.log(`[process] ${fp} -> ${file.data.slug}`)
          console.timeEnd(`${fp}`)
        }
      } catch (err) {
        trace(`\nFailed to process \`${fp}\``, err as Error)
      }
    }

    return res
  }
}

const clamp = (num: number, min: number, max: number) =>
  Math.min(Math.max(Math.round(num), min), max)
export async function parseMarkdown(argv: Argv, allSlugs: FullSlug[], fps: FilePath[]): Promise<ProcessedContent[]> {
  const log = new QuartzLogger(argv.verbose)

  // rough heuristics: 128 gives enough time for v8 to JIT and optimize parsing code paths
  const CHUNK_SIZE = 128
  const concurrency = argv.concurrency ?? clamp(fps.length / CHUNK_SIZE, 1, 4)

  let res: ProcessedContent[] = []
  log.start(`Parsing input files using ${concurrency} threads`)
  if (concurrency === 1) {
    try {
      const processor = createProcessor(allSlugs)
      const parse = createFileParser(argv, fps)
      res = await parse(processor)
    } catch (error) {
      log.end()
      throw error
    }
  } else {
    await transpileWorkerScript()
    const pool = workerpool.pool("./quartz/bootstrap-worker.mjs", {
      minWorkers: "max",
      maxWorkers: concurrency,
      workerType: "thread",
    })

    const childPromises: WorkerPromise<ProcessedContent[]>[] = []
    for (const chunk of chunks(fps, CHUNK_SIZE)) {
      childPromises.push(pool.exec("parseFiles", [argv, chunk, allSlugs]))
    }

    const results: ProcessedContent[][] = await WorkerPromise.all(childPromises).catch((err) => {
      const errString = err.toString().slice("Error:".length)
      console.error(errString)
      process.exit(1)
    })
    res = results.flat()
    await pool.terminate()
  }

  log.end(`Parsed ${res.length} Markdown files`)
  return res
}
