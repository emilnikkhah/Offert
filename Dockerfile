# Use an official Node.js runtime as a parent image
# We'll use a version of Node 18 on Alpine Linux for a smaller image size.
# Make sure this Node version is compatible with your app (e.g., 18.17.0 or later in the 18.x series)
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy package.json and package-lock.json (or npm-shrinkwrap.json) to the working directory
# This step benefits from Docker layer caching, as these files change less often than the rest of the code.
COPY package*.json ./

# Install production dependencies
# Using --omit=dev (for npm v7+) or --production (older npm versions) ensures only production dependencies are installed.
# Alpine Linux might require some build tools for certain native modules, but sqlite3 often provides pre-built binaries.
# If you encounter build issues for sqlite3, you might need to add: 
# RUN apk add --no-cache python3 make g++
RUN npm install --omit=dev

# Copy the rest of the application code into the working directory
COPY . .

# Your application binds to port 3000 (or whatever PORT is set in your app.js)
# Let Docker know the container will listen on this port.
# This should match the PORT your app.js listens on.
EXPOSE 3000

# Define the command to run your application
# This will run "node app.js" (or whatever your npm start script does)
CMD [ "npm", "start" ]
