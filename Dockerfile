
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json frontend/.npmrc* ./
RUN npm ci
COPY frontend/ .
RUN npm run build
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /server .
COPY --from=web /web/dist ./frontend/dist
ENV GIN_MODE=release
USER nobody
CMD ["./server"]