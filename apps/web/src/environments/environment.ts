// Development environment configuration
// Used when running `ng serve` locally
//
// The Angular build system replaces this file with environment.prod.ts
// when building with --configuration=production.
// See the "fileReplacements" section in angular.json.
export const environment = {
  production: false,
  // Points to the local API server started by `npm run dev` in apps/api/
  // or to the Docker Compose API container at port 3000
  apiBaseUrl: 'http://localhost:3000',
};
