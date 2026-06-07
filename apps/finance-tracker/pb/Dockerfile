# finance-tracker's OWN PocketBase container. The deploy box has no shared
# PocketBase — each app brings its own (mirrors habit-tracker / dutch-app).
# Schema lives as JS migrations under server/pb-schema/migrations/, mounted
# read-only into /pb/pb_migrations and auto-applied by `serve` on boot.
FROM alpine:3.19
ARG PB_VERSION=0.23.11

RUN apk add --no-cache ca-certificates wget unzip curl

# Deploy box is arm64 — pull the matching PocketBase build from the public
# GitHub release.
RUN wget -q \
    https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_arm64.zip \
    -O /tmp/pb.zip \
    && unzip /tmp/pb.zip -d /pb \
    && rm /tmp/pb.zip \
    && chmod +x /pb/pocketbase

WORKDIR /pb
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 8090

CMD ["./start.sh"]
