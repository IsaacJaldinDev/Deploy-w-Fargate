// Production environment configuration
// Used when building with `ng build --configuration=production`
// (which is what the Dockerfile does)
//
// IMPORTANT: Replace the apiBaseUrl value with your actual API ALB DNS name
// after completing Step 7 of the AWS Deployment Guide in the README.
// Then commit and push — the CI/CD pipeline will rebuild and redeploy the web app.
//
// Example: 'http://api-alb-123456789.us-east-1.elb.amazonaws.com'
export const environment = {
  production: true,
  apiBaseUrl: 'http://eploy-w-fargate-alb-938526909.us-east-2.elb.amazonaws.com',
};
