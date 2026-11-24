# Multi-stage Dockerfile for CineBook Frontend
# Stage 1: Build production bundle
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production serve with unprivileged Nginx
FROM nginxinc/nginx-unprivileged:alpine
USER root
RUN apk update && apk upgrade --no-cache
USER 101
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
USER 101
CMD ["nginx", "-g", "daemon off;"]
