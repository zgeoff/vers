# Tinybird

The product-analytics workspace as datafiles: `datasources/` holds the `product_events` stream, and
`pipes/` holds the query endpoints. [Analytics](../../docs/architecture/analytics.md) owns the
ingest path, the event conventions, and the event registry.

Deploy from this directory with the Tinybird CLI:

```sh
tb login
tb --cloud deploy
```

The workspace admin token lives in the `vers` 1Password vault (`tinybird` item).
