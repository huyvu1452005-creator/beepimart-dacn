FROM node:20-alpine

WORKDIR /app

# Copy package.json trước để tận dụng Docker cache
COPY package*.json ./

# Cài dependencies (chỉ production, không cài dev)
RUN npm install --production
# Copy toàn bộ source code
COPY . .

# Tạo thư mục uploads
RUN mkdir -p /app/uploads

# Chạy non-root user để tăng bảo mật
RUN addgroup -S app && adduser -S app -G app
RUN chown -R app:app /app
USER app

EXPOSE 5000

CMD ["node", "src/server.js"]