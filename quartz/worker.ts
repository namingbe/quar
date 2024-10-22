import sourceMapSupport from "source-map-support"
sourceMapSupport.install(options)
import cfg from "../quartz.config"
import { Argv } from "./util/ctx"
import { FilePath, FullSlug } from "./util/path"
import { createFileParser, createProcessor } from "./processors/parse"
import { options } from "./util/sourcemap"

// only called from worker thread
export async function parseFiles(
  argv: Argv,
  fps: FilePath[],
  allSlugs: FullSlug[],
) {
  const processor = createProcessor(cfg, allSlugs)
  const parse = createFileParser(argv, cfg, fps)
  return parse(processor)
}
