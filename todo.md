- rid of scss
- async seems to be leaking

The plugin infra seems to be unduly rigid in how map-filter-reduce is ordered
E.g. what if I want to filter on file name before mapping the contents? What if I want to apply the same content remap to original files and emits?

