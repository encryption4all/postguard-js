FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# The source code will be mounted as a volume
# This allows hot reloading during development

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
