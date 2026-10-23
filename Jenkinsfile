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
            -Dsonar.sources=backend/src/main,frontend/src \
            -Dsonar.java.binaries=backend/target/classes \
            -Dsonar.qualitygate.wait=true'''
        }
      }
    }
    stage('SonarQube: SAST') {
      steps {
        withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
          sh '''docker run --rm --network host -u $(id -u):$(id -g) -e SONAR_TOKEN -e SONAR_USER_HOME=/tmp/.sonar -v "$PWD":/usr/src sonarsource/sonar-scanner-cli \
            -Dsonar.host.url=http://localhost:9000 \
            -Dsonar.projectKey=inventory-management-system \
            -Dsonar.sources=backend/src/main,frontend/src \
            -Dsonar.java.binaries=backend/target/classes \
            -Dsonar.qualitygate.wait=true'''
        }
      }
    }
  }
}
