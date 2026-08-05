FROM node:22.12.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

# Vite embeds public VITE_* values into the browser bundle at build time.
# Railway only exposes service variables to Docker build steps when they are
# declared as ARG. Never add SUPABASE_SERVICE_ROLE_KEY here.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_WP_SITE_URL=https://omfit.com.vn

RUN node -e "for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) { if (!process.env[key]) throw new Error('Missing required build variable: ' + key); }" \
    && npm run build

FROM node:22.12.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server ./server

EXPOSE 8787

CMD ["npm", "start"]
