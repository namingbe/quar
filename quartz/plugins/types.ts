import { PluggableList } from "unified"
import { StaticResources } from "../util/resources"
import { ProcessedContent } from "./vfile"
import { QuartzComponent } from "../components/types"
import { FilePath, FullSlug } from "../util/path"
import { Argv } from "../cfg"

export interface PluginTypes {
  transformers: QuartzTransformerPluginInstance[]
  filters: QuartzFilterPluginInstance[]
  emitters: QuartzEmitterPluginInstance[]
}

type OptionType = object | undefined
export type QuartzTransformerPlugin<Options extends OptionType = undefined> = (
  opts?: Options,
) => QuartzTransformerPluginInstance
export type QuartzTransformerPluginInstance = {
  name: string
  textTransform?: (src: string | Buffer) => string | Buffer
  markdownPlugins?: () => PluggableList
  htmlPlugins?: (allSlugs: FullSlug[]) => PluggableList
  externalResources?: () => Partial<StaticResources>
}

export type QuartzFilterPlugin = (
) => QuartzFilterPluginInstance
export type QuartzFilterPluginInstance = {
  name: string
  shouldPublish(content: ProcessedContent): boolean
}

export type QuartzEmitterPlugin<Options extends OptionType = undefined> = (
  opts?: Options,
) => QuartzEmitterPluginInstance
export type QuartzEmitterPluginInstance = {
  name: string
  emit(argv: Argv, content: ProcessedContent[], resources: StaticResources): Promise<FilePath[]>
  getQuartzComponents(): QuartzComponent[]
}
