terraform {
  required_version = ">= 1.5"

  # State is kept on the Jenkins VM (path is passed at init time)
  backend "local" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# Use the default VPC and its subnets (no extra NAT cost)
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_caller_identity" "current" {}

# One customer-managed key for ECR images and EKS secrets
resource "aws_kms_key" "securestock" {
  description         = "SecureStock encryption key"
  enable_key_rotation = true

  # Account root controls the key; access for roles is granted through IAM policies
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AccountAdmin"
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
      Action    = "kms:*"
      Resource  = "*"
    }]
  })
}

# Private image registries, immutable tags, scan on push
resource "aws_ecr_repository" "app" {
  for_each             = toset(["backend", "frontend"])
  name                 = "securestock-${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.securestock.arn
  }
}

# EKS control plane role
resource "aws_iam_role" "eks_cluster" {
  name = "securestock-eks-cluster"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

# Lets the EKS control plane use the key for secrets encryption
resource "aws_iam_role_policy" "eks_kms" {
  name = "securestock-eks-kms"
  role = aws_iam_role.eks_cluster.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["kms:Encrypt", "kms:Decrypt", "kms:ListGrants", "kms:DescribeKey"]
      Resource = aws_kms_key.securestock.arn
    }]
  })
}

resource "aws_eks_cluster" "securestock" {
  name     = "securestock-eks"
  role_arn = aws_iam_role.eks_cluster.arn

  #checkov:skip=CKV_AWS_39:Public endpoint is limited to one admin CIDR (CKV_AWS_38 passes); needed so Jenkins can deploy
  #checkov:skip=CKV_AWS_339:Kubernetes version is left to the EKS default for this project

  vpc_config {
    subnet_ids              = data.aws_subnets.default.ids
    endpoint_public_access  = true
    endpoint_private_access = true
    public_access_cidrs     = [var.authorized_cidr]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  encryption_config {
    resources = ["secrets"]
    provider {
      key_arn = aws_kms_key.securestock.arn
    }
  }

  depends_on = [aws_iam_role_policy_attachment.eks_cluster, aws_iam_role_policy.eks_kms]
}

# Worker node role
resource "aws_iam_role" "eks_nodes" {
  name = "securestock-eks-nodes"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "nodes_worker" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "nodes_cni" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "nodes_ecr" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_eks_node_group" "primary" {
  cluster_name    = aws_eks_cluster.securestock.name
  node_group_name = "primary"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = data.aws_subnets.default.ids
  instance_types  = ["m7i-flex.large"]

  scaling_config {
    desired_size = 1
    min_size     = 1
    max_size     = 2
  }

  depends_on = [
    aws_iam_role_policy_attachment.nodes_worker,
    aws_iam_role_policy_attachment.nodes_cni,
    aws_iam_role_policy_attachment.nodes_ecr,
  ]
}
