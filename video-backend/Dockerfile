# Dockerfile for service1
FROM node:16-alpine

# Create and set working directory
WORKDIR /video-backend

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --silent

# Copy the rest of the app files
COPY . .

# Expose the port your service runs on 
EXPOSE 4000

# Start the service
CMD ["node", "index"]
