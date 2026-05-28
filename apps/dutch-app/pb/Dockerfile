FROM alpine:3.19
ARG PB_VERSION=0.23.11

RUN apk add --no-cache ca-certificates wget unzip curl

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
