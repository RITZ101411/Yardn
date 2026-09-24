# Contributing

## Development

Install dependencies:

```sh
npm --prefix api ci
cargo build
```

Start the API locally with the Kubernetes PostgreSQL and controller:

```sh
make dev
```

Run the required checks before submitting a pull request:

```sh
make check
```

Apply the current code and manifests to the local Kubernetes cluster:

```sh
make deploy-local
```

## Pull Requests

- Branch from `main`
- Branch name: `feat/description`, `fix/description`, `docs/description`, etc.
- Keep PRs focused — one feature or fix per PR
- Ensure `make check` passes before submitting
- Direct pushes to `main` are blocked; all changes go through PRs

## Commit Messages

```text
prefix(scope): content
```

### Prefix

- `feat` — New feature
- `fix` — Bug fix
- `refactor` — Code restructuring without behavior change
- `docs` — Documentation
- `chore` — Build, config, and other maintenance

### Scope

Use the affected component: `api`, `controller`, `cli`, or `shared`.

The scope can be omitted when changes span multiple components.

### Examples

```text
feat(api): add project deploy endpoint
fix(controller): reject unmanaged resources
fix(cli): correct tar.gz compression excluding node_modules
refactor(api): split K8s operations into service layer
docs: update contributing guide
chore: add local development commands
```
