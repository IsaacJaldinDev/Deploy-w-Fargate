import { Router } from 'express';

const router = Router();

// GET /health
// Used by the ALB target group health check in production.
// ECS will only route traffic to tasks that return a 2xx from this endpoint.
// If you change the path, update the Target Group health check path in AWS.
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /version
// Returns the git commit SHA that was baked into the Docker image at build time.
// The CI/CD pipeline passes --build-arg GIT_COMMIT_SHA=${{ github.sha }} to
// docker build, which sets it as an environment variable in the image.
//
// This is the "proof" that CI/CD works — after a deploy, hit this endpoint
// and verify that the SHA matches the commit that triggered the pipeline.
router.get('/version', (_req, res) => {
  res.json({ commit: process.env.GIT_COMMIT_SHA ?? 'unknown' });
});

export default router;
