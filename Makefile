# Makefile для генерации CA, серверного сертификата Redis и клиентских сертификатов
# Запуск:   make REDIS_IP=10.0.0.5 REDIS_DOCKER_HOST=redis
# Очистка:  make clean
#
# ВАЖНО: REDIS_IP ДОЛЖЕН СОВПАДАТЬ С ТЕМ IP, по которому клиенты подключаются к Redis "снаружи".
# А REDIS_DOCKER_HOST — это hostname, по которому к Redis ходят контейнеры в docker-сети.

CERTS_DIR ?= certs
DAYS      ?= 3650

COUNTRY   ?= RU
STATE     ?= Moscow
LOCALITY  ?= Moscow
ORG       ?= Sqwoz-Hrov
OU_INFRA  ?= Infra
OU_SVC    ?= Services

CA_CN        ?= MyRedis-CA
REDIS_CN     ?= redis          # CN можно оставить любым, хостнейм будет проверяться по SAN
PUBLISHER_CN ?= publisher
WORKER_CN    ?= worker

# IP адрес Redis, который пойдёт в SAN (subjectAltName) для доступа "снаружи"
REDIS_IP ?= 127.0.0.1

# Hostname Redis в docker-сети (имя сервиса в docker-compose)
REDIS_DOCKER_HOST ?= lms-redis

CA_DIR        = $(CERTS_DIR)/ca
PUB_REDIS_DIR = $(CERTS_DIR)/publisher-and-redis
WORKER_DIR    = $(CERTS_DIR)/worker

DIRS = $(CA_DIR) $(PUB_REDIS_DIR) $(WORKER_DIR)

CA_KEY  = $(CA_DIR)/ca.key
CA_CRT  = $(CA_DIR)/ca.crt
CA_PUBLISHER_CRT = $(PUB_REDIS_DIR)/ca.crt
CA_WORKER_CRT    = $(WORKER_DIR)/ca.crt

REDIS_KEY = $(PUB_REDIS_DIR)/redis.key
REDIS_CSR = $(PUB_REDIS_DIR)/redis.csr
REDIS_CRT = $(PUB_REDIS_DIR)/redis.crt
REDIS_EXT = $(PUB_REDIS_DIR)/redis.ext

PUBLISHER_KEY = $(PUB_REDIS_DIR)/publisher.key
PUBLISHER_CSR = $(PUB_REDIS_DIR)/publisher.csr
PUBLISHER_CRT = $(PUB_REDIS_DIR)/publisher.crt

WORKER_KEY = $(WORKER_DIR)/worker.key
WORKER_CSR = $(WORKER_DIR)/worker.csr
WORKER_CRT = $(WORKER_DIR)/worker.crt

.PHONY: all clean tree

all: $(CA_CRT) $(CA_PUBLISHER_CRT) $(CA_WORKER_CRT) $(REDIS_CRT) $(PUBLISHER_CRT) $(WORKER_CRT)
  @echo "==> All certificates generated in $(CERTS_DIR)"
  @echo "==> Redis SAN IP (external): $(REDIS_IP)"
  @echo "==> Redis SAN DNS (docker):  $(REDIS_DOCKER_HOST)"

tree:
  @tree $(CERTS_DIR) 2>/dev/null || ls -l $(CERTS_DIR)

$(DIRS):
  mkdir -p $@

########################################
# CA
########################################

$(CA_KEY): | $(CA_DIR)
  openssl genrsa -out $(CA_KEY) 4096

$(CA_CRT): $(CA_KEY)
  openssl req -x509 -new -nodes \
    -key $(CA_KEY) \
    -sha256 -days $(DAYS) \
    -out $(CA_CRT) \
    -subj "/C=$(COUNTRY)/ST=$(STATE)/L=$(LOCALITY)/O=$(ORG)/OU=$(OU_INFRA)/CN=$(CA_CN)"

$(CA_PUBLISHER_CRT): $(CA_CRT) | $(PUB_REDIS_DIR)
  cp $(CA_CRT) $(CA_PUBLISHER_CRT)

$(CA_WORKER_CRT): $(CA_CRT) | $(WORKER_DIR)
  cp $(CA_CRT) $(CA_WORKER_CRT)

########################################
# Redis (server) с SAN по IP + docker DNS
########################################

$(REDIS_KEY): | $(PUB_REDIS_DIR)
  openssl genrsa -out $(REDIS_KEY) 4096

$(REDIS_CSR): $(REDIS_KEY)
  openssl req -new \
    -key $(REDIS_KEY) \
    -out $(REDIS_CSR) \
    -subj "/C=$(COUNTRY)/ST=$(STATE)/L=$(LOCALITY)/O=$(ORG)/OU=$(OU_INFRA)/CN=$(REDIS_CN)"

$(REDIS_EXT): | $(PUB_REDIS_DIR)
  @echo "subjectAltName = @alt_names"  > $(REDIS_EXT)
  @echo ""                             >> $(REDIS_EXT)
  @echo "[alt_names]"                  >> $(REDIS_EXT)
  @echo "IP.1  = $(REDIS_IP)"          >> $(REDIS_EXT)
  @echo "DNS.1 = $(REDIS_DOCKER_HOST)" >> $(REDIS_EXT)
  @echo "DNS.2 = localhost"            >> $(REDIS_EXT)

$(REDIS_CRT): $(REDIS_CSR) $(CA_CRT) $(CA_KEY) $(REDIS_EXT)
  openssl x509 -req \
    -in $(REDIS_CSR) \
    -CA $(CA_CRT) -CAkey $(CA_KEY) -CAcreateserial \
    -out $(REDIS_CRT) \
    -days $(DAYS) -sha256 \
    -extfile $(REDIS_EXT)

########################################
# Publisher (client)
########################################

$(PUBLISHER_KEY): | $(PUB_REDIS_DIR)
  openssl genrsa -out $(PUBLISHER_KEY) 4096

$(PUBLISHER_CSR): $(PUBLISHER_KEY)
  openssl req -new \
    -key $(PUBLISHER_KEY) \
    -out $(PUBLISHER_CSR) \
    -subj "/C=$(COUNTRY)/ST=$(STATE)/L=$(LOCALITY)/O=$(ORG)/OU=$(OU_SVC)/CN=$(PUBLISHER_CN)"

$(PUBLISHER_CRT): $(PUBLISHER_CSR) $(CA_CRT) $(CA_KEY)
  openssl x509 -req \
    -in $(PUBLISHER_CSR) \
    -CA $(CA_CRT) -CAkey $(CA_KEY) -CAcreateserial \
    -out $(PUBLISHER_CRT) \
    -days $(DAYS) -sha256

########################################
# Clean
########################################

clean:
  rm -rf $(DIRS)
  @echo "==> Cleaned $(CERTS_DIR)"
