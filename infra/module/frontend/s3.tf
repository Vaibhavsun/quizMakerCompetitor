variable "project" { type = string }

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "site" {
  bucket        = "${var.project}-frontend-${random_id.suffix.hex}"
  force_destroy = true
  tags          = { Name = "${var.project}-frontend" }
}

# Relax the default block so the public-read bucket policy can apply.
resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Static website hosting: index.html serves as both the default doc and
# the error doc, giving the SPA fallback for client-side routes.
resource "aws_s3_bucket_website_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  index_document { suffix = "index.html" }
  error_document { key    = "index.html" }
}

data "aws_iam_policy_document" "site" {
  statement {
    sid    = "PublicRead"
    effect = "Allow"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket     = aws_s3_bucket.site.id
  policy     = data.aws_iam_policy_document.site.json
  depends_on = [aws_s3_bucket_public_access_block.site]
}
