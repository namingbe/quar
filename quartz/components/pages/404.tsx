import { config } from "../../../quartz.config"
import { i18n } from "../../i18n"
import { QuartzComponent, QuartzComponentConstructor } from "../types"

const NotFound: QuartzComponent = () => {
  // If baseUrl contains a pathname after the domain, use this as the home link
  const url = new URL(`https://${config.baseUrl ?? "example.com"}`)
  const baseDir = url.pathname

  return (
    <article class="popover-hint">
      <h1>404</h1>
      <p>{i18n(config.locale).pages.error.notFound}</p>
      <a href={baseDir}>{i18n(config.locale).pages.error.home}</a>
    </article>
  )
}

export default (() => NotFound) satisfies QuartzComponentConstructor
