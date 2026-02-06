---
description: How to deploy the backend to AWS EC2
---

# Deploy Backend to AWS

This workflow explains how to deploy the latest changes to the AWS EC2 instance.

## Prerequisites
- SSH key: [pos-key.pem](file:///e:/Project/pos-key.pem)
- Target Server: `13.239.29.168`

## Deployment Steps

### 1. Connect to the Server
Run the following command in your terminal:
```bash
ssh -i "e:/Project/pos-key.pem" ec2-user@13.239.29.168
```

### 2. Transfer Build from Local to AWS (Optional)
If you built on your machine and want to upload the `dist` folder:
Run this on **your local machine** (not inside SSH):
```bash
scp -r -i "e:/Project/pos-key.pem" e:/Project/Order-Project-Backend/dist ec2-user@13.239.29.168:~/Order-Project-Backend/
```

### 3. Update and Restart Backend
Once connected to the server, run these commands:
```bash
# Navigate to project directory
cd ~/Order-Project-Backend

# Update code from Git
git pull origin master

# Install dependencies
npm install

# Build the project
npm run build

# Restart the process using PM2
pm2 restart pos-backend
```

### 3. Verify Status
Check if the backend is running correctly:
```bash
pm2 status
pm2 logs pos-backend
```
