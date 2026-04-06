# APIs — billing and project creation are handled by bootstrap.sh.
resource "google_project_service" "apis" {
  for_each = toset([
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "dns.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}
