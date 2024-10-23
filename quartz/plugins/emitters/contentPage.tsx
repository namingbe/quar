import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import cfg from "../../../quartz.config"
import { FullPageLayout } from "../../cfg"
import { FilePath, pathToRoot } from "../../util/path"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { Content } from "../../components"
import chalk from "chalk"
import { write } from "./helpers"

export const ContentPage: QuartzEmitterPlugin<Partial<FullPageLayout>> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultContentPageLayout,
    pageBody: Content(),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "ContentPage",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
      ]
    },
    async emit(argv, content, resources): Promise<FilePath[]> {
      const fps: FilePath[] = []
      const allFiles = content.map((c) => c[1].data)

      let containsIndex = false
      for (const [tree, file] of content) {
        const slug = file.data.slug!
        if (slug === "index") {
          containsIndex = true
        }

        const externalResources = pageResources(pathToRoot(slug), resources)
        const componentData: QuartzComponentProps = {
          argv,
          fileData: file.data,
          externalResources,
          cfg: cfg.configuration,
          children: [],
          tree,
          allFiles,
        }

        const content = renderPage(cfg.configuration, slug, componentData, opts, externalResources)
        const fp = await write({
          argv,
          content,
          slug,
          ext: ".html",
        })

        fps.push(fp)
      }

      if (!containsIndex) {
        console.log(
          chalk.yellow(
            `\nWarning: you seem to be missing an \`index.md\` home page file at the root of your \`${argv.directory}\` folder. This may cause errors when deploying.`,
          ),
        )
      }

      return fps
    },
  }
}
