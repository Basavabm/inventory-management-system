output "ecr_repositories" {
  value = { for k, r in aws_ecr_repository.app : k => r.repository_url }
}

output "eks_cluster_name" {
  value = aws_eks_cluster.securestock.name
}
