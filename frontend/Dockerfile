# 前端Dockerfile - 开发环境
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install --legacy-peer-deps

# 复制源代码
COPY . .

# 构建应用（如果需要预构建）
# RUN npm run build

# 暴露端口
EXPOSE 5174

# 启动开发服务器
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]