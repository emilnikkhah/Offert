# Använd en officiell Node.js runtime som basimage
# Välj en version som är kompatibel med ditt projekt, t.ex. en LTS-version
FROM node:18

# Skapa appkatalogen
WORKDIR /usr/src/app

# Installera appberoenden
# En wildcard används för att säkerställa att både package.json AND package-lock.json kopieras
# där det är tillgängligt (npm@5+)
COPY package*.json ./

# För SQLite och Puppeteer kan det behövas extra paket
# För Puppeteer (Debian-baserad bild som node:18):
RUN apt-get update && apt-get install -yq \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 \
    libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 \
    libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation \
    libappindicator1 libnss3 lsb-release xdg-utils wget libgbm-dev libxshmfence-dev \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Installera projektberoenden (inklusive devDependencies om tester eller byggsteg körs i Docker)
# För en produktionsbuild, använd `npm ci --only=production` om du har en package-lock.json och vill ha en renare build
# Eller `npm install --omit=dev` (npm 7+) / `npm install --production` (äldre npm)
RUN npm install --production

# Paketera appens källkod
COPY . .

# Se till att databaskatalogen finns och har rättigheter (om den skapas av appen vid start)
# Detta är dock mer relevant om du volymmonterar en extern databasfil.
# För en SQLite-databas som ingår i imagen, se till att den kopieras korrekt.
# Om db/offert_db.sqlite skapas av appen och ska finnas i containern,
# så se till att appen har skrivrättigheter till /usr/src/app/db
RUN mkdir -p /usr/src/app/db && chown -R node:node /usr/src/app/db

# Din app lyssnar på port 3000
EXPOSE 3000

# Använd en icke-root användare för säkerhetsskäl
USER node

# Definiera kommandot för att köra appen
CMD [ "npm", "start" ]
