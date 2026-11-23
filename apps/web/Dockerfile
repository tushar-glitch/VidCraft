FROM node:16-alpine

# Set the working directory
WORKDIR /video-frontend

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies with no logs
RUN npm install --silent

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
