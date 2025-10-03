# vercel-video-proxy

Use this project to proxy video files through Vercel for legal streaming.

## Environment
Set these in Vercel:
- UPSTREAM_BASE
- PROXY_API_KEY
- CORS_ORIGIN

## Deployment
1. Copy all files into a GitHub repository.
2. Connect the repo to Vercel and deploy.
3. Use the proxy endpoint for video playback:
   https://<your-deploy>/api/proxy/path/to/video.mp4