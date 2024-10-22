import path from "path"
import fs from "fs"
import { FilePath, FullSlug, joinSegments } from "../../util/path"
import { Argv } from "../../cfg"

type WriteOptions = {
  argv: Argv,
  slug: FullSlug
  ext: `.${string}` | ""
  content: string | Buffer
}

export const write = async ({ argv, slug, ext, content }: WriteOptions): Promise<FilePath> => {
  const pathToPage = joinSegments(argv.output, slug + ext) as FilePath
  const dir = path.dirname(pathToPage)
  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(pathToPage, content)
  return pathToPage
}
