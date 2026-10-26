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
      options { timeout(time: 90, unit: 'MINUTES') }
      steps {
        withCredentials([string(credentialsId: 'nvd-api-key', variable: 'NVD_RAW')]) {
          sh '''NVD_KEY=$(printf %s "$NVD_RAW" | tr -d '[:space:]')
          mkdir -p odc-reports
          docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -e JAVA_OPTS=-Xmx1g \
            -v "$PWD":/src -v /var/lib/jenkins/odc-data:/odc-data \
            owasp/dependency-check:latest \
            --scan "/src/backend/target/*.jar" --scan /src/frontend/package-lock.json \
            --data /odc-data --out /src/odc-reports --format HTML --format JSON \
            --disableNodeAudit --nvdApiKey "$NVD_KEY"'''
        }
        archiveArtifacts artifacts: 'odc-reports/*', allowEmptyArchive: true
      }
    }
  }
}
