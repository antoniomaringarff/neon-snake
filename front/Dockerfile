# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
RUN echo 'server { \n\
  listen 80; \n\
  location / { \n\
    root /usr/share/nginx/html; \n\
    index index.html; \n\
    try_files $uri $uri/ /index.html; \n\
  } \n\
  location /api { \n\
    proxy_pass http://api:3000; \n\
    proxy_http_version 1.1; \n\
    proxy_set_header Upgrade $http_upgrade; \n\
    proxy_set_header Connection "upgrade"; \n\
    proxy_set_header Host $host; \n\
    proxy_cache_bypass $http_upgrade; \n\
  } \n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
