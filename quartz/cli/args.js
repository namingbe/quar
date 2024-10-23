export const CommonArgv = {
  directory: {
    string: true,
    alias: ["d"],
    default: "content",
    describe: "directory to look for content files",
  },
  verbose: {
    boolean: true,
    alias: ["v"],
    default: false,
    describe: "print out extra logging information",
  },
}

export const CreateArgv = {
  ...CommonArgv,
  source: {
    string: true,
    alias: ["s"],
    describe: "source directory to copy/create symlink from",
  },
  strategy: {
    string: true,
    alias: ["X"],
    choices: ["new", "copy", "symlink"],
    describe: "strategy for content folder setup",
  },
  links: {
    string: true,
    alias: ["l"],
    choices: ["absolute", "shortest", "relative"],
    describe: "strategy to resolve links",
  },
}

export const BuildArgv = {
  ...CommonArgv,
  output: {
    string: true,
    alias: ["o"],
    default: "public",
    describe: "output folder for files",
  },
  concurrency: {
    number: true,
    describe: "how many threads to use to parse notes",
  },
}
