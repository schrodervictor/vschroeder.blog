---
title: Deploying a static website to Firebase Hosting
description: >
  Infrastructure as code for a static blog: bootstrapping a GCP project,
  provisioning Firebase Hosting with Terraform, and wiring up DNS at Spaceship.
pubDate: 2026-04-06
author: Victor Schroeder
tags:
  - terraform
  - gcp
  - firebase
  - devops
  - blog
---

In the [previous post](/posts/20260405-building-this-blog/), I set up the blog
itself using Astro, a terminal theme, and did some adjustments. Now it's time
to deploy it somewhere, so people can actually see it.

Astro builds the content as static files, which makes hosting very easy. For a
static site, you just need something that serves files from a CDN with HTTPS.
There are many options:

- **GitHub Pages**: free, zero config, deploy on push. Tied to GitHub.
- **Cloudflare Pages**: free tier, fast CDN, great DX. Connect a repo and go.
- **Netlify**: similar to Cloudflare Pages, deploy previews for PRs.
- **Vercel**: native Astro support, free tier, serverless-first.
- **AWS S3 + CloudFront**: full control, more moving parts.
- **GCP Cloud Storage + Cloud CDN**: same idea, Google's ecosystem.
- **Firebase Hosting**: CDN, HTTPS, custom domains, atomic deploys, all managed.

After some quick consideration, I decided to go with Firebase Hosting. I've been
wanting to play with it for a while already, but never really had a good
excuse. The promise is that it should be simple to set up and offer many
interesting services to be plugged on top.

One command deploys, automatic SSL,
rollback from the console if something goes wrong. The free tier (10 GB storage,
360 MB/day transfer) is more than enough for a blog.

So now we have a clear goal: deploy a static site to Firebase Hosting on GCP,
with infrastructure managed by Terraform and DNS automated at my registrar
(Spaceship). No click-ops, no manual steps that I'll forget in six months.

## Using Terraform: the chicken-and-egg problem

One could totally deploy a static website on Firebase by clicking around the
web console on GCP, Firebase and the DNS server (yes, three different places
to spread your precious clicks). Not my style. I'll keep Everything-as-Code
as much as I can.

Terraform (or OpenTofu) needs a GCS bucket to store its state, but you need a
GCP project and billing to create a bucket. And you need the bucket before you
can run `terraform init`.

I already have my organization on GCP and a billing account, but of course I'll
create a new project for this deployment. It means I have to wire these things
together, which can be done on the web console of GCP, but as a matter of
exercising good practices, should be avoided.

The solution: a small bootstrap script that creates just enough for Terraform
to take over.

**Bootstrap handles:**
- GCP project creation
- Billing account linking
- Infra state bucket (with versioning)

**Terraform/OpenTofu handles everything else:**
- API enablement
- Firebase project
- Hosting site
- Custom domain
- DNS records

This way there's a clear ownership boundary. The bootstrap script is idempotent
and safe to run multiple times.

## The bootstrap script

```bash
#!/usr/bin/env bash
set -euo pipefail

msg() { printf '%s\n' "$@"; }
err() { msg "$@" >&2; }

bootstrap() {
    if [ "$#" -ne 3 ]; then
        err "Usage: $0 <project-id> <billing-account-id> <region>"
        return 1
    fi

    local project_id="$1"
    local billing_account_id="$2"
    local region="$3"
    local state_bucket="$project_id-infra-state"

    # ...
}

if [ "$0" = "${BASH_SOURCE[0]}" ]; then
    bootstrap "$@"
fi
```

The logic is wrapped in a `bootstrap` function, with argument validation
(here very simple), local variables instead of globals, and a source guard at
the bottom so it can be sourced without executing. This is Bash scripting
101, but often overlooked.

All three arguments are required, no defaults to accidentally deploy to the
wrong region.

```shell
$ ./scripts/bootstrap.sh vschroeder-blog 012345-6789AB-CDEF01 europe-west10
```

What follows is a small sequence of operations to ensure the state is
according to expectation. In the script, each step checks if the resource
already exists before creating it.

I invite you to check the [full script on GitHub](https://github.com/schrodervictor/vschroeder.blog/blob/main/scripts/bootstrap.sh), but I'll mention the main
steps, in case you want to run this manually. You need to set the variables to
the values you want or replace them directly when running the commands:

```shell
# Create the project by giving it an id
$ gcloud projects create "$project_id"

# Link the project to a billing account
$ gcloud billing projects link "$project_id" \
    --billing-account="$billing_account_id"

# Create the bucket for infra state
$ gcloud storage buckets create "gs://$state_bucket" \
    --project="$project_id" \
    --location="$region" \
    --uniform-bucket-level-access

# Enable versioning for the infra state bucket
$ gcloud storage buckets update "gs://$state_bucket" --versioning
```

## Terraform/OpenTofu structure

After bootstrap, the infra lives in [`infra/tf/`](https://github.com/schrodervictor/vschroeder.blog/tree/main/infra/tf):

```
infra/tf/
├── main.tf          # providers, backend config
├── variables.tf     # project_id, region, domain
├── project.tf       # API enablement
├── firebase.tf      # hosting site, custom domain
└── dns.tf           # DNS records at Spaceship
```

### Provider setup

Three providers: Google (for APIs), Google Beta (for Firebase resources, which
are still in beta), and Spaceship (for DNS). Spaceship is where my domain is
registered, you may need a different one for your own domain:

```hcl
required_providers {
  google = {
    source  = "hashicorp/google"
    version = "~> 6.0"
  }
  google-beta = {
    source  = "hashicorp/google-beta"
    version = "~> 6.0"
  }
  spaceship = {
    source  = "namecheap/spaceship"
    version = "~> 0.0"
  }
}
```

The GCS backend uses the bucket created by bootstrap:

```hcl
backend "gcs" {
  prefix = "infra/state"
}
```

Bucket name is passed at init time:

```shell
$ terraform init -backend-config="bucket=vschroeder-blog-infra-state"
```

### API enablement

The following will enable all the GCP APIs the project needs:

```hcl
resource "google_project_service" "apis" {
  for_each = toset([
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "dns.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
```

The `disable_on_destroy = false` is important: you don't want `terraform
destroy` to disable APIs that other resources might depend on.

### Firebase Hosting

The Firebase resources form a dependency chain:

```hcl
# 1. Add Firebase to the GCP project
resource "google_firebase_project" "this" {
  provider   = google-beta
  project    = var.project_id
  depends_on = [google_project_service.apis]
}

# 2. Create the hosting site
resource "google_firebase_hosting_site" "blog" {
  provider   = google-beta
  project    = var.project_id
  site_id    = var.project_id
  depends_on = [google_firebase_project.this]
}

# 3. Attach the custom domain
resource "google_firebase_hosting_custom_domain" "blog" {
  provider      = google-beta
  project       = var.project_id
  site_id       = google_firebase_hosting_site.blog.site_id
  custom_domain = var.domain
}
```

Each resource depends on the previous one. Terraform handles the ordering
automatically through `depends_on` and implicit references.

## The Firebase CLI gotcha

Here's something that cost me time: even with Owner role on the GCP project,
`firebase projects:addfirebase` fails with a cryptic `403 PERMISSION_DENIED` if
you've never accepted the Firebase Terms of Service for that project.

The error message says "The caller does not have permission", no hint that it's
about ToS acceptance. The only fix is to go to
[console.firebase.google.com](https://console.firebase.google.com/), click "Add
project", and select your existing GCP project through the web UI.

This is a one-time thing per Google account (or per project?), but it's
frustrating because the CLI gives you no indication of what's actually
wrong. I added a check in the bootstrap script so that if this happens, it
tells you exactly what to do instead of just failing.

In the end, I moved the Firebase setup to Terraform entirely. The
`google_firebase_project` resource handles this cleanly.

## Automating DNS

My domain `vschroeder.blog` is registered at Spaceship, which has a Terraform
provider. This means I can automate the DNS records that Firebase needs.

### First attempt: dynamic records (didn't work, kinda)

My initial idea was elegant: `google_firebase_hosting_custom_domain` exposes a
`required_dns_updates` attribute with the exact DNS records Firebase needs. I'd
read those dynamically and create them at Spaceship:

```hcl
locals {
  firebase_dns_records = google_firebase_hosting_custom_domain.blog
    .required_dns_updates[0].desired[0].records
}

resource "spaceship_dns_records" "blog" {
  domain = var.domain

  records = [
    for r in local.firebase_dns_records : {
      type    = r.type
      name    = r.domain_name == var.domain ? "@" : replace(r.domain_name, ".${var.domain}", "")
      address = contains(["A", "AAAA"], r.type) ? r.rdata : null
      value   = r.type == "TXT" ? r.rdata : null
      cname   = r.type == "CNAME" ? r.rdata : null
      ttl     = 3600
    }
  ]
}
```

This worked perfectly on the first `terraform apply`: the records were created
at Spaceship, DNS propagated, Firebase verified the domain.

But on the next apply:

```
Error: Invalid index
  firebase_dns_records = ...required_dns_updates[0].desired[0].records
  google_firebase_hosting_custom_domain.blog.required_dns_updates is empty list
```

The problem: `required_dns_updates` is a **transient signal**. Firebase
populates it while waiting for DNS verification, then clears it once the domain
is verified. My Terraform code was reading from a value that disappears after
it's consumed.

Worse, if I handled the empty case by defaulting to `[]`, the Spaceship resource
would see an empty records list and **delete all the DNS records** it was
managing. Domain goes down.

### What actually works: static records

Firebase Hosting uses well-known, stable IP addresses. The verification TXT
records don't change either. So the right approach is to just declare them
explicitly:

```hcl
resource "spaceship_dns_records" "blog" {
  domain = var.domain

  records = [
    {
      type    = "A"
      name    = "@"
      address = "199.36.158.100"
      ttl     = 3600
    },
    {
      type  = "TXT"
      name  = "@"
      value = "hosting-site=vschroeder-blog"
      ttl   = 3600
    },
    {
      type  = "TXT"
      name  = "_acme-challenge"
      value = "nOYN4FrQfD4wcDve1grcJUF0rAgYbL-3mxNtAnrRFgQ"
      ttl   = 3600
    },
  ]
}
```

We need these three records:
- **A** record pointing the apex domain to Firebase's hosting IP
- **TXT** at the apex for domain ownership verification
- **TXT** at `_acme-challenge` for SSL certificate provisioning

This is stable across applies, and a future `terraform destroy` would cleanly
remove the records when decommissioning.

The Spaceship provider authenticates via environment variables, which have to
be exported to the terminal session to run the tf commands:

```shell
$ export SPACESHIP_API_KEY="your-key"
$ export SPACESHIP_API_SECRET="your-secret"
$ terraform apply
```

## Deploying content

The bootstrap script and Terraform code take care of the infrastructure. To
deploy the actual blog content we need to interact with the `firebase` cli,
which can be installed with `npm install --global firebase-tools`, bringing
737 dependencies and all the risk of supply chain attacks again...

Anyway, be sure you have it installed, either globally or locally:

```shell
$ npm install --before="$(date -d '7 days ago' +%Y-%m-%d)" --global firebase-tools
```

In the project, the [`firebase.json`](https://github.com/schrodervictor/vschroeder.blog/blob/main/firebase.json) config file tells what to upload:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "**/*.html",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=3600" }
        ]
      },
      {
        "source": "**/*.@(svg|woff2|ico|png|jpg|webp)",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=86400" }
        ]
      }
    ]
  }
}
```

Cache headers are deliberately conservative for now. HTML always revalidates, JS/CSS
cached for an hour, assets for a day. I'll tighten these once the design stabilizes.

The deploy is a [`Makefile`](https://github.com/schrodervictor/vschroeder.blog/blob/main/Makefile) target:

```makefile
deploy: build
	firebase deploy --only hosting --project vschroeder-blog
```

`make deploy` builds the site and uploads it in one step. No CI/CD for now, I
deploy from my machine when ready. Automation can come later.

## The full workflow

I know it sounds like a lot, but it's really not that much. From zero to
deployed:

```shell
# 1. One-time bootstrap
$ ./scripts/bootstrap.sh vschroeder-blog 012345-6789AB-CDEF01 europe-west10

# 2. Provision infrastructure
$ cd infra/tf
$ terraform init -backend-config="bucket=vschroeder-blog-infra-state"
$ terraform apply

# 3. Build and deploy content
$ make deploy
```

After that, writing and publishing a new post:

```shell
# Write
$ vim src/content/posts/20260406-my-new-post.md

# Publish
$ make deploy
```

Two commands. The rest is having fun writing Markdown.

## Things that went wrong

For the sake of honesty, here's what didn't work on the first try:

1. **Firebase CLI 403 error**: the ToS issue described above. Wasted a good
   chunk of time debugging what turned out to be a web-only workaround.

2. **Spaceship provider `dynamic` blocks**: the provider uses list attributes,
   not nested blocks. `dynamic "records"` failed with "Blocks of type records
   are not expected here." Switching to a `for` expression fixed it.

3. **`gcloud` vs `firebase` CLI auth**: these are separate auth sessions.
   Being logged into gcloud doesn't mean the Firebase CLI is authenticated. Had
   to run `firebase login` separately.

4. **Application Default Credentials**: `terraform init` failed because
   Terraform couldn't find credentials for the GCS backend. Fixed with
   `gcloud auth application-default login`.

5. **Transient DNS records**: my dynamic approach to reading Firebase's
   `required_dns_updates` worked on the first apply but broke on every
   subsequent one. The attribute empties out after domain verification, causing
   an index error, or worse, deleting the DNS records. Had to switch to static
   records.

None of these were hard to fix, but they're the kind of thing that eats an
afternoon if you're not expecting them.

## What's next

The blog is live, the infra is code, the DNS is (semi-)automated. Next up:
start writing more content, iterate on the design, and add the features
that made me choose Astro in the first place: keyboard shortcuts, tmux-style
layouts, and making this thing feel like a real terminal.
