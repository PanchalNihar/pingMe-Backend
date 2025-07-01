# Step 1: Base image
FROM node:18-slim

# Step 2: Set working directory in container
WORKDIR /app

# Step 3: Copy only package files first
COPY package*.json ./

# Step 4: Install dependencies
RUN npm install

# Step 5: Copy rest of the app files
COPY . .

# Step 6: Expose port
EXPOSE 3000

# Step 7: Run the app
CMD ["node", "index.js"]
