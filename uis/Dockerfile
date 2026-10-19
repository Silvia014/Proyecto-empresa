FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/talent-pipeline-tracker

COPY uis/talent-pipeline-tracker/package.json uis/talent-pipeline-tracker/package-lock.json ./
RUN npm ci

COPY uis/talent-pipeline-tracker/ ./

COPY index.html styles.css main.js account.html account.js \
     order.html order.js order.css \
     reserva.html reserva.js \
     aplicar.html aplicar.js checkout.html checkout.js \
     candidates.html candidates.js candidates.css \
     candidate-detail.html candidate-detail.js \
     candidate-new.html candidate-new.js \
     reset-password.html reset-password.js \
     translations.js validation.js chat.js \
     /usr/share/nginx/html/website/

COPY uis/talent-pipeline-tracker/app/favicon.ico /usr/share/nginx/html/website/favicon.ico

COPY uis/backoffice/ /usr/share/nginx/html/backoffice/
COPY uis/nginx.conf /etc/nginx/conf.d/default.conf
COPY uis/start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 3000 3001

CMD ["/start.sh"]
