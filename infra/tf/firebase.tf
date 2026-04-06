resource "google_firebase_project" "this" {
  provider = google-beta
  project  = local.project_id

  depends_on = [google_project_service.apis]
}

resource "google_firebase_hosting_site" "blog" {
  provider = google-beta
  project  = local.project_id
  site_id  = local.project_id

  depends_on = [google_firebase_project.this]
}

resource "google_firebase_hosting_custom_domain" "blog" {
  provider      = google-beta
  project       = local.project_id
  site_id       = google_firebase_hosting_site.blog.site_id
  custom_domain = local.domain
}

output "default_url" {
  description = "Default Firebase Hosting URL"
  value       = "https://${google_firebase_hosting_site.blog.site_id}.web.app"
}

output "custom_domain" {
  description = "Custom domain"
  value       = "https://${local.domain}"
}
