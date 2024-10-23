import { promises } from "fs"
import path from "path"
import esbuild from "esbuild"
import chalk from "chalk"
import { sassPlugin } from "esbuild-sass-plugin"
import fs from "fs"
import { intro, outro, select, text } from "@clack/prompts"
import { rimraf } from "rimraf"
import prettyBytes from "pretty-bytes"
import { randomUUID } from "crypto"
import { CreateArgv } from "./args.js"
import {
  exitIfCancel,
  escapePath,
} from "./helpers.js"
import {
  version,
  fp,
  cacheFile,
  cwd,
} from "./constants.js"

/**
 * Handles `npx quartz create`
 * @param {*} argv arguments for `create`
 */
export async function handleCreate(argv) {
  console.log()
  intro(chalk.bgGreen.black(` Quartz v${version} `))
  const contentFolder = path.join(cwd, argv.directory)
  let setupStrategy = argv.strategy?.toLowerCase()
  let linkResolutionStrategy = argv.links?.toLowerCase()
  const sourceDirectory = argv.source

  // If all cmd arguments were provided, check if theyre valid
  if (setupStrategy && linkResolutionStrategy) {
    // If setup isn't, "new", source argument is required
    if (setupStrategy !== "new") {
      // Error handling
      if (!sourceDirectory) {
        outro(
          chalk.red(
            `Setup strategies (arg '${chalk.yellow(
              `-${CreateArgv.strategy.alias[0]}`,
            )}') other than '${chalk.yellow(
              "new",
            )}' require content folder argument ('${chalk.yellow(
              `-${CreateArgv.source.alias[0]}`,
            )}') to be set`,
          ),
        )
        process.exit(1)
      } else {
        if (!fs.existsSync(sourceDirectory)) {
          outro(
            chalk.red(
              `Input directory to copy/symlink 'content' from not found ('${chalk.yellow(
                sourceDirectory,
              )}', invalid argument "${chalk.yellow(`-${CreateArgv.source.alias[0]}`)})`,
            ),
          )
          process.exit(1)
        } else if (!fs.lstatSync(sourceDirectory).isDirectory()) {
          outro(
            chalk.red(
              `Source directory to copy/symlink 'content' from is not a directory (found file at '${chalk.yellow(
                sourceDirectory,
              )}', invalid argument ${chalk.yellow(`-${CreateArgv.source.alias[0]}`)}")`,
            ),
          )
          process.exit(1)
        }
      }
    }
  }

  // Use cli process if cmd args werent provided
  if (!setupStrategy) {
    setupStrategy = exitIfCancel(
      await select({
        message: `Choose how to initialize the content in \`${contentFolder}\``,
        options: [
          { value: "new", label: "Empty Quartz" },
          { value: "copy", label: "Copy an existing folder", hint: "overwrites `content`" },
          {
            value: "symlink",
            label: "Symlink an existing folder",
            hint: "don't select this unless you know what you are doing!",
          },
        ],
      }),
    )
  }

  async function rmContentFolder() {
    const contentStat = await fs.promises.lstat(contentFolder)
    if (contentStat.isSymbolicLink()) {
      await fs.promises.unlink(contentFolder)
    } else {
      await rimraf(contentFolder)
    }
  }

  const gitkeepPath = path.join(contentFolder, ".gitkeep")
  if (fs.existsSync(gitkeepPath)) {
    await fs.promises.unlink(gitkeepPath)
  }
  if (setupStrategy === "copy" || setupStrategy === "symlink") {
    let originalFolder = sourceDirectory

    // If input directory was not passed, use cli
    if (!sourceDirectory) {
      originalFolder = escapePath(
        exitIfCancel(
          await text({
            message: "Enter the full path to existing content folder",
            placeholder:
              "On most terminal emulators, you can drag and drop a folder into the window and it will paste the full path",
            validate(fp) {
              const fullPath = escapePath(fp)
              if (!fs.existsSync(fullPath)) {
                return "The given path doesn't exist"
              } else if (!fs.lstatSync(fullPath).isDirectory()) {
                return "The given path is not a folder"
              }
            },
          }),
        ),
      )
    }

    await rmContentFolder()
    if (setupStrategy === "copy") {
      await fs.promises.cp(originalFolder, contentFolder, {
        recursive: true,
        preserveTimestamps: true,
      })
    } else if (setupStrategy === "symlink") {
      await fs.promises.symlink(originalFolder, contentFolder, "dir")
    }
  } else if (setupStrategy === "new") {
    await fs.promises.writeFile(
      path.join(contentFolder, "index.md"),
      `---
title: Welcome to Quartz
---

This is a blank Quartz installation.
See the [documentation](https://quartz.jzhao.xyz) for how to get started.
`,
    )
  }

  // Use cli process if cmd args werent provided
  if (!linkResolutionStrategy) {
    // get a preferred link resolution strategy
    linkResolutionStrategy = exitIfCancel(
      await select({
        message: `Choose how Quartz should resolve links in your content. This should match Obsidian's link format. You can change this later in \`quartz.config.ts\`.`,
        options: [
          {
            value: "shortest",
            label: "Treat links as shortest path",
            hint: "(default)",
          },
          {
            value: "absolute",
            label: "Treat links as absolute path",
          },
          {
            value: "relative",
            label: "Treat links as relative paths",
          },
        ],
      }),
    )
  }

  // now, do config changes
  const configFilePath = path.join(cwd, "quartz.config.ts")
  let configContent = await fs.promises.readFile(configFilePath, { encoding: "utf-8" })
  configContent = configContent.replace(
    /markdownLinkResolution: '(.+)'/,
    `markdownLinkResolution: '${linkResolutionStrategy}'`,
  )
  await fs.promises.writeFile(configFilePath, configContent)

  outro(`You're all set! Not sure what to do next? Try:
  • Customizing Quartz a bit more by editing \`quartz.config.ts\`
  • Hosting your Quartz online (see: https://quartz.jzhao.xyz/hosting)
`)
}

/**
 * Handles `npx quartz build`
 * @param {*} argv arguments for `build`
 */
export async function handleBuild(argv) {
  console.log(chalk.bgGreen.black(`\n Quartz v${version} \n`))
  const ctx = await esbuild.context({
    entryPoints: [fp],
    outfile: cacheFile,
    bundle: true,
    keepNames: true,
    minifyWhitespace: true,
    minifySyntax: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "preact",
    packages: "external",
    metafile: true,
    sourcemap: true,
    sourcesContent: false,
    plugins: [
      sassPlugin({
        type: "css-text",
        cssImports: true,
      }),
      {
        name: "inline-script-loader",
        setup(build) {
          build.onLoad({ filter: /\.inline\.(ts|js)$/ }, async (args) => {
            let text = await promises.readFile(args.path, "utf8")

            // remove default exports that we manually inserted
            text = text.replace("export default", "")
            text = text.replace("export", "")

            const sourcefile = path.relative(path.resolve("."), args.path)
            const resolveDir = path.dirname(sourcefile)
            const transpiled = await esbuild.build({
              stdin: {
                contents: text,
                loader: "ts",
                resolveDir,
                sourcefile,
              },
              write: false,
              bundle: true,
              minify: true,
              platform: "browser",
              format: "esm",
            })
            const rawMod = transpiled.outputFiles[0].text
            return {
              contents: rawMod,
              loader: "text",
            }
          })
        },
      },
    ],
  })

  let cleanupBuild = null
  const build = async (clientRefresh) => {
    if (cleanupBuild) {
      await cleanupBuild()
      console.log(chalk.yellow("Detected a source code change, doing a hard rebuild..."))
    }

    const result = await ctx.rebuild().catch((err) => {
      console.error(`${chalk.red("Couldn't parse Quartz configuration:")} ${fp}`)
      console.log(`Reason: ${chalk.grey(err)}`)
      process.exit(1)
    })

    if (argv.bundleInfo) {
      const outputFileName = "quartz/.quartz-cache/transpiled-build.mjs"
      const meta = result.metafile.outputs[outputFileName]
      console.log(
        `Successfully transpiled ${Object.keys(meta.inputs).length} files (${prettyBytes(
          meta.bytes,
        )})`,
      )
      console.log(await esbuild.analyzeMetafile(result.metafile, { color: true }))
    }

    // bypass module cache
    // https://github.com/nodejs/modules/issues/307
    const { default: buildQuartz } = await import(`../../${cacheFile}?update=${randomUUID()}`)
    // ^ this import is relative, so base "cacheFile" path can't be used

    cleanupBuild = await buildQuartz(argv, clientRefresh)
    clientRefresh()
  }

  await build(() => {})
  ctx.dispose()
}

