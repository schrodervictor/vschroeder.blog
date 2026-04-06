resource "google_firebase_project" "this" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_firebase_hosting_site" "blog" {
  provider = google-beta
  project  = var.project_id
  site_id  = var.project_id

  depends_on = [google_firebase_project.this]
}

resource "google_firebase_hosting_custom_domain" "blog" {
  provider      = google-beta
  project       = var.project_id
  site_id       = google_firebase_hosting_site.blog.site_id
  custom_domain = var.domain
}

output "default_url" {
  description = "Default Firebase Hosting URL"
  value       = "https://${google_firebase_hosting_site.blog.site_id}.web.app"
}

output "custom_domain" {
  description = "Custom domain"
  value       = "https://${var.domain}"
}
