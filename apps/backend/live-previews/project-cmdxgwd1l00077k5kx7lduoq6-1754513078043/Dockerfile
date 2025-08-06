# Generic Node.js App Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 4003

# Set environment variables
ENV PORT=4003
ENV NODE_ENV=development

# Start the development server
CMD ["npm", "start"]