output "public_ip" {
  value = aws_instance.backend.public_ip
}

output "public_dns" {
  value = aws_instance.backend.public_dns
}

output "security_group_id" {
  value = aws_security_group.backend.id
}
