FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    fonts-beng \
    fonts-beng-extra \
    fontconfig \
    && fc-cache -fv \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install telethon --break-system-packages

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p temp queue

EXPOSE 3000
CMD ["node", "server.js"]
