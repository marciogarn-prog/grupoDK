# EC33 — estudo para Localização dos veículos (Grupo DK)

## Equipamento do titular

- Modelo: **EC33 GNSS Vehicle Terminal** (4G + 2G)
- IMEI (etiqueta): **869137082186396**
- Módulo: **Quectel EG915-LA** (manual Mobidrive)
- Bateria: 300 mAh · Alimentação veículo: **9–90 V**
- Protocolo de servidor: **GT06** sobre **TCP** (não JT808)
- Comandos de frota: texto terminado em `#` (manual págs. 12–16)

## Como a posição chega ao portal

O USB no PC **não** é o canal de frota em tempo real.

1. O EC33 usa chip **SIM M2M** com dados (GPRS/4G).
2. Envia pacotes binários GT06 (`0x78 0x78`…) para um **servidor TCP** (IP/DNS + porta).
3. O bridge DK (`scripts/gt06-tcp-bridge.mjs`) recebe, decodifica e grava em `/api/dk-veiculo-geo`.
4. O mapa **Localização dos veículos** lê essa API (igual ao mapa de clientes).

## Comandos sem SMS (GPRS / plataforma)

Depois que o EC33 faz **login** no bridge (`SERVER` apontado):

1. No mapa DK o titular envia STATUS / WHERE / PARAM / RELAY / TIMER / cerca.
2. A API enfileira o comando (`/api/dk-veiculo-geo` → `acao=comando`).
3. O bridge faz `claim` da fila e envia o **mesmo texto** no pacote GT06 **`0x80`**.
4. O aparelho responde em **`0x15`** (string); o bridge grava `comando_resultado` com `via=gt06_gprs`.

A **1ª** configuração (`APN` + `SERVER`) ainda costuma precisar de **SMS** (ou chip com SMS). USB Quectel (`AT…`) é só diagnóstico do modem — não substitui os comandos `#` da app GT06.

## Comandos SMS essenciais

| Função | Comando |
| --- | --- |
| Apontar servidor (DNS) | `SERVER,1,SEU_DNS,PORTA,0#` |
| Apontar servidor (IP) | `SERVER,0,SEU_IP,PORTA,0#` |
| Consultar servidor | `SERVER#` |
| APN | `APN,apn,usuario,senha#` |
| Intervalo posição | `TIMER,30,1800#` (ACC ON / ACC OFF, segundos) |
| Heartbeat | `HBT,180,180#` |
| Status | `STATUS#` |
| Parâmetros / IMEI | `PARAM#` |
| Última posição | `WHERE#` |
| Reiniciar | `RESET#` |
| Bloquear / liberar | `RELAY,1#` / `RELAY,0#` |
| Fuso | `GMT,W,0,0#` |

Exemplo APN Vivo M2M: `APN,smart.m2m.vivo.com.br,vivo,vivo#`

## Pacotes GT06 (resumo)

- Login `0x01` → traz IMEI
- Posição `0x12` / `0x22` → lat/lng, velocidade, curso, hora
- Status/heartbeat `0x13` → ACC, bateria, GSM
- Alarme `0x16`
- Servidor deve **ACK** cada pacote (senão o aparelho reconecta e gasta dados)

## Fiação (manual)

- Vermelho: +12 V · Preto: GND · Laranja: ACC · Amarelo: bloqueio (relé)

## Ficheiros baixados nesta pasta

- `Manual_EC33_Mobidrive.pdf` + `Manual_EC33_texto.txt`
- `GT06_Protocol_v1.8.1.pdf` (Traccar / Concox)
- `GT06_SMS_Commands_EN.pdf`
- `smartgps_ec33.html`

## Driver USB Quectel

Download oficial (conta Quectel):  
https://www.quectel.com/download/quectel_windows_usb_driverq_ndis_v2-8_en/

Após instalar: devem aparecer portas **Quectel USB AT Port (COMx)**.
