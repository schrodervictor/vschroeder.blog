# DNS records at Spaceship for Firebase Hosting.
#
# These are static values — Firebase Hosting IPs are well-known and stable.
# The TXT records handle domain ownership verification and SSL provisioning.
# If Firebase ever changes its IPs (extremely unlikely), update here.

resource "spaceship_dns_records" "blog" {
  domain = var.domain

  records = [
    {
      type    = "A"
      name    = "@"
      address = "199.36.158.100"
      ttl     = 60
    },
    {
      type  = "TXT"
      name  = "@"
      value = "hosting-site=vschroeder-blog"
      ttl   = 60
    },
    {
      type  = "TXT"
      name  = "_acme-challenge"
      value = "nOYN4FrQfD4wcDve1grcJUF0rAgYbL-3mxNtAnrRFgQ"
      ttl   = 60
    },
  ]
}
