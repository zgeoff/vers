# Tinybird

The product-analytics workspace as datafiles: `datasources/` holds the `product_events` stream,
`pipes/` the query endpoints. Ingest path, event conventions, and the registry:
`docs/architecture/analytics.md`.

Deploy from this directory with the Tinybird CLI:

```sh
tb login
tb --cloud deploy
```

The workspace admin token lives in the `vers` 1Password vault (`tinybird` item).
