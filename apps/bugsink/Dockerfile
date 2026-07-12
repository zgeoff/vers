# Bugsink with an R2 object-storage backend for uploaded files. Extends the
# pinned stock image with boto3 and our sourcemap-to-R2 wiring; upgrading Bugsink
# is still a tag bump on the FROM line. The base image's config template is kept
# as bugsink_conf_base so our bugsink_conf.py inherits it and overrides only the
# file object storage.
FROM bugsink/bugsink:2.4.0

USER root

RUN pip install --no-cache-dir boto3==1.43.46

RUN cp /app/bugsink_conf.py /app/bugsink_conf_base.py
COPY r2_storage.py /app/r2_storage.py
COPY bugsink_conf.py /app/bugsink_conf.py
RUN chown bugsink /app/bugsink_conf_base.py /app/r2_storage.py /app/bugsink_conf.py

USER bugsink
