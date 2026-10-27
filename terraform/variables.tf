variable "region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "authorized_cidr" {
  description = "CIDR allowed to reach the EKS API endpoint (your public IP, e.g. 1.2.3.4/32)"
  type        = string
}
