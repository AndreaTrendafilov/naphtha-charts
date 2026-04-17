## Migrations Operator

This chart installs [migrations-operator](https://github.com/AndreaTrendafilov/migrations-operator) **v1.2.5**, a Kubernetes controller that watches `Migrator` custom resources and coordinates database migration jobs.

Default image: `ghcr.io/andreatrendafilov/migrations-operator:v1.2.5` (see [release](https://github.com/AndreaTrendafilov/migrations-operator/releases/tag/v1.2.5)).

The operator runs in the `migrations-system` namespace, installs the `Migrator` CRD, and configures admission webhooks.
