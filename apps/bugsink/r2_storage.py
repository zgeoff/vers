"""
Bugsink object-storage backend that keeps uploaded files (sourcemap artifact
bundles) in Cloudflare R2 over its S3-compatible API, instead of the Postgres
row. Registered as the ``file`` object kind's write storage in bugsink_conf.py.

Bugsink resolves this class by dotted path and constructs it as
``R2ObjectStorage(name, object_kind=..., **OPTIONS)``; credentials and target
bucket come from the R2_* environment (Fly secrets) so no secret is baked in.
The four methods below are Bugsink's ObjectStorage contract: open() is a context
manager yielding a readable ('rb') or writable ('wb') file object.
"""

import os
from contextlib import contextmanager
from io import BytesIO

import boto3
from botocore.config import Config

from files.storage import ObjectStorage


class R2ObjectStorage(ObjectStorage):
    def __init__(
        self,
        name,
        object_kind,
        bucket=None,
        endpoint_url=None,
        access_key_id=None,
        secret_access_key=None,
        **kwargs,
    ):
        super().__init__(name, object_kind, **kwargs)
        self.bucket = bucket or os.environ["R2_BUCKET"]
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url or os.environ["R2_ENDPOINT_URL"],
            aws_access_key_id=access_key_id or os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=secret_access_key or os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )

    def exists(self, key):
        try:
            self._client.head_object(Bucket=self.bucket, Key=str(key))
            return True
        except self._client.exceptions.ClientError as exc:
            if exc.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
                return False
            raise

    def delete(self, key):
        self._client.delete_object(Bucket=self.bucket, Key=str(key))

    @contextmanager
    def open(self, key, mode="rb"):
        if mode == "rb":
            body = self._client.get_object(Bucket=self.bucket, Key=str(key))["Body"]
            try:
                yield body
            finally:
                body.close()
        elif mode == "wb":
            buffer = BytesIO()
            yield buffer
            self._client.put_object(Bucket=self.bucket, Key=str(key), Body=buffer.getvalue())
        else:
            raise ValueError("ObjectStorage.open() mode must be 'rb' or 'wb'")

    def list(self):
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket):
            for obj in page.get("Contents", []):
                yield obj["Key"]
