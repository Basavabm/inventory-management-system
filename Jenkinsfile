pipeline {
  agent any
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
  }
}
