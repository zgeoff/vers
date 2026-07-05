# Static-only deployable: no workspace deps, so no turbo prune stage —
# the pages under public/ are served exactly as committed.
FROM nginx:1.27-alpine

COPY public/ /usr/share/nginx/html/
