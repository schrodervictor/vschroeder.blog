# vschroeder.blog

A terminal-themed blog about programming and technology, built with
[Astro](https://astro.build) and deployed to
[Firebase Hosting](https://firebase.google.com/docs/hosting) on GCP.

Live at [vschroeder.blog](https://vschroeder.blog).

## Prerequisites

- [Node.js](https://nodejs.org/)
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) (for infrastructure)
- [Firebase CLI](https://firebase.google.com/docs/cli) (for deploys)
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
  (or [OpenTofu](https://opentofu.org/))

## Local development

```bash
make dev       # install deps + start dev server on localhost:4321
make build     # type check + build to dist/
make preview   # serve dist/ locally
make test      # run unit tests
make check     # type check only
```

## Writing a post

Create a Markdown file in `src/content/posts/`:

```markdown
---
title: 'My Post Title'
description: 'A short description'
pubDate: 2026-04-04
author: 'Victor Schroeder'
tags: ['topic']
---

Your content here...
```

### Shell snippet conventions

Use the `shell` language hint for interactive sessions. Commands start with
`$ `, comments with `# `. The copy button strips prompts and output
automatically. Use `bash`/`sh`/`zsh` for scripts (these get line numbers).

## Infrastructure

Infrastructure is managed with Terraform in `infra/tf/`. DNS is automated at
Spaceship via the Spaceship Terraform provider.

### 1. Bootstrap the GCP project

One-time setup that creates the GCP project, links billing, and creates a GCS
bucket for Terraform state. Safe to run multiple times.

```bash
make bootstrap BILLING=<your-billing-account-id>
```

### 2. Initialize and apply Terraform

```bash
make tf-init
make tf-apply
```

If you use OpenTofu or a different binary name:

```bash
make tf-apply TF=tofu
```

Terraform creates:
- Firebase project and hosting site
- Custom domain and DNS records at Spaceship (A, TXT ownership, TXT ACME
  challenge)

### 3. Deploy

```bash
make deploy
```

This builds the site and deploys to Firebase Hosting in one step.

## Updating dependencies

```bash
make update
```

Only installs package versions at least 7 days old (via npm `--before` flag)
to mitigate supply chain attacks. Post-install scripts are disabled via
`.npmrc`.
