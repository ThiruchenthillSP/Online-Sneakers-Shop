pipeline {
  agent any
  options { timestamps(); disableConcurrentBuilds() }
  parameters {
    booleanParam(name: 'DEPLOY', defaultValue: false, description: 'Build and start the local Docker service')
  }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Environment') { steps { bat 'node --version && npm --version' } }
    stage('Syntax Check') { steps { bat 'npm run check' } }
    stage('Automated Tests') { steps { bat 'npm test' } }
    stage('Docker Build') {
      when { expression { return params.DEPLOY } }
      steps { bat 'docker compose build' }
    }
    stage('Deploy') {
      when { expression { return params.DEPLOY } }
      steps { bat 'docker compose up -d && docker compose ps' }
    }
    stage('Health Check') {
      when { expression { return params.DEPLOY } }
      steps { bat 'powershell -NoProfile -Command "Start-Sleep -Seconds 5; $r=Invoke-WebRequest http://localhost:8091/api/health -UseBasicParsing; if ($r.StatusCode -ne 200) { exit 1 }"' }
    }
  }
  post {
    always { archiveArtifacts artifacts: 'README.md,docs/**', allowEmptyArchive: true }
  }
}
