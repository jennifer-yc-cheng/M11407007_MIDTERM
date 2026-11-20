# 第一階段：編譯 Vue（node 只存在於這個暫時的 build container 裡）
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# 第二階段：Nginx 同時負責提供前端網頁與 API Gateway
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
