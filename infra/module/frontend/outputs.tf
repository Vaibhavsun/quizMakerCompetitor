output "amplify_app_id" {
  description = "Amplify app ID (null until github vars are set)"
  value       = local.enabled ? aws_amplify_app.site[0].id : null
  sensitive   = true
}

output "amplify_url" {
  description = "Deployed Amplify URL (null until github vars are set and a build has run)"
  value       = local.enabled ? "https://${var.branch}.${aws_amplify_app.site[0].default_domain}" : null
  sensitive   = true
}
