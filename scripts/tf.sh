#!/bin/sh
# Run Terraform in Docker. Usage: sh scripts/tf.sh <terraform arguments>
exec docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
  -e AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-southeast-2}" \
  -e TF_PLUGIN_CACHE_DIR=/state/plugins \
  -v "$PWD/terraform":/tf -v /var/lib/jenkins/tfstate:/state \
  -w /tf hashicorp/terraform:1.9 "$@"
