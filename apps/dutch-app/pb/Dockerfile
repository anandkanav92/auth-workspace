FROM alpine:3.19
ARG PB_VERSION=0.23.11
ARG TARGETARCH

RUN apk add --no-cache ca-certificates wget unzip curl

# Download the correct architecture binary
RUN ARCH=$(case "${TARGETARCH}" in \
      "amd64") echo "amd64" ;; \
      "arm64") echo "arm64" ;; \
      *) uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/' ;; \
    esac) && \
    wget -q \
    https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip \
    -O /tmp/pb.zip \
    && unzip /tmp/pb.zip -d /pb \
    && rm /tmp/pb.zip \
    && chmod +x /pb/pocketbase

WORKDIR /pb
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 8090

CMD ["./start.sh"]
