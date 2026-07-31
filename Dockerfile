FROM python:3.12-slim

WORKDIR /srv/app

# Pure standard library — no pip install.
COPY index.html ./
COPY css/ css/
COPY js/ js/
COPY server.py ./
COPY README.md ./

ENV SOE_RC_HOST=0.0.0.0
ENV PORT=8080
ENV SOE_RC_DATA=/data

EXPOSE 8080

# Create data dir for non-volume local runs
RUN mkdir -p /data

CMD ["python3", "server.py"]
