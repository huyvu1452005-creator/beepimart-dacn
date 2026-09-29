FROM nginx:alpine

# Xóa config mặc định
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy toàn bộ file frontend
COPY . /usr/share/nginx/html/

# Copy nginx config tùy chỉnh
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]