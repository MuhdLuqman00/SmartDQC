FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Relative base: the browser calls the frontend origin and nginx proxies /api
# to the api container (see nginx.multi.conf). No API host is baked into the
# bundle, so the same image works on any host. Override with --build-arg only
# if the browser must reach the API at an absolute URL.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.multi.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
