import path from "path"
import { FilePath } from "./path"
import { globby } from "globby"
import cfg from "../../quartz.config"

export function toPosixPath(fp: string): string {
  return fp.split(path.sep).join("/")
}

export async function glob(
  pattern: string,
  cwd: string,
  ignorePatterns: string[],
): Promise<FilePath[]> {
  const fps = (
    await globby(pattern, {
      cwd,
      ignore: [...ignorePatterns, ...cfg.configuration.ignorePatterns],
      gitignore: true,
    })
  ).map(toPosixPath)
  return fps as FilePath[]
}
