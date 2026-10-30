pipeline {
  agent any
  parameters {
    booleanParam(name: 'PROVISION', defaultValue: false, description: 'Create ECR + EKS on AWS (costs about $0.14/hour)')
    booleanParam(name: 'DESTROY', defaultValue: false, description: 'Delete everything Terraform created on AWS')
    booleanParam(name: 'DEPLOY', defaultValue: false, description: 'Push images to ECR and deploy SecureStock to EKS')
  }
  options { timestamps() }
  stages {
    stage('Gitleaks: Secret Scan') {
      steps {
        sh 'docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -v "$PWD":/repo ghcr.io/gitleaks/gitleaks:latest detect --source /repo --redact --verbose'
      }
    }
    stage('Maven: Backend Build') {
      steps {
        sh 'docker run --rm -u $(id -u):$(id -g) -v "$PWD/backend":/app -w /app maven:3.9-eclipse-temurin-17 mvn -B -Duser.home=/tmp clean package -DskipTests'
      }
    }
    stage('npm: Frontend Build') {
      steps {
        sh 'docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -v "$PWD/frontend":/app -w /app node:20 sh -c "npm ci && npm run build"'
      }
    }
    stage('SonarQube: SAST') {
      steps {
        withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
          sh '''docker run --rm --network host -u $(id -u):$(id -g) -e SONAR_TOKEN -e SONAR_USER_HOME=/tmp/.sonar -v "$PWD":/usr/src sonarsource/sonar-scanner-cli \
            -Dsonar.host.url=http://localhost:9000 \
            -Dsonar.projectKey=inventory-management-system \
            -Dsonar.working.directory=/tmp/scannerwork-run \
            -Dsonar.sources=backend/src/main,frontend/src \
            -Dsonar.java.binaries=backend/target/classes \
            -Dsonar.qualitygate.wait=true'''
        }
      }
    }
    stage('OWASP Dependency-Check: SCA') {
      options { timeout(time: 30, unit: 'MINUTES') }
      steps {
        sh '''mkdir -p odc-reports
        docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -e JAVA_OPTS=-Xmx1g \
          -v "$PWD":/src -v /var/lib/jenkins/odc-data:/odc-data \
          owasp/dependency-check:latest \
          --scan "/src/backend/target/*.jar" --scan /src/frontend/package-lock.json \
          --data /odc-data --out /src/odc-reports --format HTML --format JSON \
          --disableNodeAudit --noupdate'''
        archiveArtifacts artifacts: 'odc-reports/*', allowEmptyArchive: true
      }
    }
    stage('Docker Image Build') {
      steps {
        sh '''docker build -t securestock-backend:${BUILD_NUMBER} backend
        docker build -t securestock-frontend:${BUILD_NUMBER} frontend'''
      }
    }
    stage('Trivy: Container Image Scan') {
      steps {
        sh '''mkdir -p trivy-reports
        for img in backend frontend; do
          trivy image --no-progress --severity HIGH,CRITICAL --format json --output trivy-reports/$img.json securestock-$img:${BUILD_NUMBER}
          trivy image --no-progress --severity HIGH,CRITICAL securestock-$img:${BUILD_NUMBER}
        done'''
        archiveArtifacts artifacts: 'trivy-reports/*', allowEmptyArchive: true
      }
    }
    stage('Security Gate') {
      steps {
        sh '''for img in backend frontend; do
          trivy image --no-progress --severity CRITICAL --ignore-unfixed --exit-code 1 securestock-$img:${BUILD_NUMBER}
        done'''
      }
    }
    stage('Terraform: Validate') {
      steps {
        sh '''docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -v "$PWD/terraform":/tf -w /tf hashicorp/terraform:1.9 init -backend=false -input=false
        docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -v "$PWD/terraform":/tf -w /tf hashicorp/terraform:1.9 validate'''
      }
    }
    stage('Checkov: IaC Security Scan') {
      steps {
        sh 'docker run --rm -v "$PWD/terraform":/tf bridgecrew/checkov:latest -d /tf --framework terraform --compact --skip-download --soft-fail'
      }
    }
    stage('Infrastructure Gate') {
      steps {
        sh 'docker run --rm -v "$PWD/terraform":/tf bridgecrew/checkov:latest -d /tf --framework terraform --compact --quiet --skip-download'
      }
    }
    stage('Terraform: Plan') {
      when { expression { return params.PROVISION } }
      steps {
        withCredentials([string(credentialsId: 'aws-access-key-id', variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: 'aws-secret-access-key', variable: 'AWS_SECRET_ACCESS_KEY')]) {
          sh '''mkdir -p /var/lib/jenkins/tfstate/plugins
          CIDR="$(curl -s https://checkip.amazonaws.com | tr -d '[:space:]')/32"
          echo "EKS API will be limited to $CIDR"
          sh scripts/tf.sh init -input=false -backend-config=path=/state/terraform.tfstate
          sh scripts/tf.sh plan -input=false -var=authorized_cidr=$CIDR -out=tfplan'''
        }
      }
    }
    stage('Approval: Provision AWS') {
      when { expression { return params.PROVISION } }
      steps {
        timeout(time: 30, unit: 'MINUTES') {
          input message: 'Create ECR + EKS on AWS now? Review the plan above. Costs about $0.14/hour.', ok: 'Apply'
        }
      }
    }
    stage('Terraform: Apply') {
      when { expression { return params.PROVISION } }
      steps {
        withCredentials([string(credentialsId: 'aws-access-key-id', variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: 'aws-secret-access-key', variable: 'AWS_SECRET_ACCESS_KEY')]) {
          sh '''sh scripts/tf.sh apply -input=false tfplan
          sh scripts/tf.sh output'''
        }
      }
    }
    stage('Terraform: Destroy') {
      when { expression { return params.DESTROY } }
      steps {
        timeout(time: 30, unit: 'MINUTES') {
          input message: 'DELETE the AWS resources created by Terraform?', ok: 'Destroy'
        }
        withCredentials([string(credentialsId: 'aws-access-key-id', variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: 'aws-secret-access-key', variable: 'AWS_SECRET_ACCESS_KEY')]) {
          sh '''export AWS_DEFAULT_REGION=ap-southeast-2 KUBECONFIG="$WORKSPACE/.kubeconfig"
          aws eks update-kubeconfig --name securestock-eks && kubectl delete namespace securestock --timeout=300s || true
          CIDR="$(curl -s https://checkip.amazonaws.com | tr -d '[:space:]')/32"
          sh scripts/tf.sh init -input=false -backend-config=path=/state/terraform.tfstate
          sh scripts/tf.sh destroy -input=false -auto-approve -var=authorized_cidr=$CIDR'''
        }
      }
    }
    stage('ECR: Push Images') {
      when { expression { return params.DEPLOY } }
      steps {
        withCredentials([string(credentialsId: 'aws-access-key-id', variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: 'aws-secret-access-key', variable: 'AWS_SECRET_ACCESS_KEY')]) {
          sh '''export AWS_DEFAULT_REGION=ap-southeast-2
          ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
          REGISTRY=$ACCOUNT.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
          aws ecr get-login-password | docker login --username AWS --password-stdin $REGISTRY
          for img in backend frontend; do
            docker tag securestock-$img:${BUILD_NUMBER} $REGISTRY/securestock-$img:${BUILD_NUMBER}
            docker push $REGISTRY/securestock-$img:${BUILD_NUMBER}
          done
          docker logout $REGISTRY'''
        }
      }
    }
    stage('EKS: Deploy') {
      when { expression { return params.DEPLOY } }
      steps {
        withCredentials([string(credentialsId: 'aws-access-key-id', variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: 'aws-secret-access-key', variable: 'AWS_SECRET_ACCESS_KEY')]) {
          sh '''export AWS_DEFAULT_REGION=ap-southeast-2 KUBECONFIG="$WORKSPACE/.kubeconfig"
          ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
          REGISTRY=$ACCOUNT.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
          aws eks update-kubeconfig --name securestock-eks
          kubectl apply -f k8s/namespace.yaml
          kubectl -n securestock get secret db-credentials >/dev/null 2>&1 || kubectl -n securestock create secret generic db-credentials --from-literal=password="$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)"
          sed -e "s|__BACKEND_IMAGE__|$REGISTRY/securestock-backend:${BUILD_NUMBER}|" -e "s|__FRONTEND_IMAGE__|$REGISTRY/securestock-frontend:${BUILD_NUMBER}|" k8s/securestock.yaml > rendered.yaml
          kubectl apply -f rendered.yaml
          kubectl -n securestock rollout status deployment/postgres --timeout=180s
          kubectl -n securestock rollout status deployment/backend --timeout=420s
          kubectl -n securestock rollout status deployment/frontend --timeout=180s'''
        }
      }
    }
    stage('Health Checks and Smoke Tests') {
      when { expression { return params.DEPLOY } }
      steps {
        withCredentials([string(credentialsId: 'aws-access-key-id', variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: 'aws-secret-access-key', variable: 'AWS_SECRET_ACCESS_KEY')]) {
          sh '''export AWS_DEFAULT_REGION=ap-southeast-2 KUBECONFIG="$WORKSPACE/.kubeconfig"
          aws eks update-kubeconfig --name securestock-eks
          kubectl -n securestock get pods
          LB=""
          for i in $(seq 1 40); do
            LB=$(kubectl -n securestock get svc frontend -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
            [ -n "$LB" ] && break
            echo "waiting for the load balancer..."; sleep 15
          done
          [ -n "$LB" ] || { echo "No load balancer address"; exit 1; }
          echo "App URL: http://$LB"
          code=000
          for i in $(seq 1 30); do
            code=$(curl -s -o /dev/null -w "%{http_code}" http://$LB/api/products || true)
            echo "attempt $i: /api/products -> $code"
            [ "$code" = "200" ] && break
            sleep 15
          done
          [ "$code" = "200" ] || { echo "Smoke test failed: API did not answer 200"; exit 1; }
          curl -sf -o /dev/null http://$LB/ || { echo "Smoke test failed: frontend page"; exit 1; }
          echo "Smoke tests passed"'''
        }
      }
    }
  }
}
