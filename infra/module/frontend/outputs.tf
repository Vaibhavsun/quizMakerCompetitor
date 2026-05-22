output "bucket_name" {
  description = "S3 bucket holding the built frontend artifacts"
  value       = aws_s3_bucket.site.id
}

output "website_url" {
  description = "Public S3 static-website URL (HTTP only)"
  value       = "http://${aws_s3_bucket_website_configuration.site.website_endpoint}"
}
