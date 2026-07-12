"""
Adapter tests for r2_storage against a mocked S3 (moto). Bugsink's ObjectStorage
base is stubbed here — the real one only raises NotImplementedError — so the
adapter imports without installing Bugsink; these exercise the concrete R2/S3
behaviour, which is the part that can break.
"""

import os
import sys
import types

import boto3
import pytest
from moto import mock_aws

_storage = types.ModuleType("files.storage")


class ObjectStorage:
    def __init__(self, name, object_kind, **options):
        self.name = name
        self.object_kind = object_kind


_storage.ObjectStorage = ObjectStorage
sys.modules.setdefault("files", types.ModuleType("files"))
sys.modules["files.storage"] = _storage

os.environ.setdefault("R2_ENDPOINT_URL", "https://s3.amazonaws.com")
os.environ.setdefault("R2_BUCKET", "test-bucket")
os.environ.setdefault("R2_ACCESS_KEY_ID", "test-key")
os.environ.setdefault("R2_SECRET_ACCESS_KEY", "test-secret")

import r2_storage  # noqa: E402


@pytest.fixture
def storage():
    with mock_aws():
        boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="test-bucket")
        yield r2_storage.R2ObjectStorage("r2", object_kind="file")


def test_write_then_read_roundtrips(storage):
    with storage.open("bundle/app.js.map", "wb") as f:
        f.write(b"sourcemap-bytes")
    with storage.open("bundle/app.js.map", "rb") as f:
        assert f.read() == b"sourcemap-bytes"


def test_exists_reflects_presence(storage):
    assert storage.exists("bundle/app.js.map") is False
    with storage.open("bundle/app.js.map", "wb") as f:
        f.write(b"x")
    assert storage.exists("bundle/app.js.map") is True


def test_list_yields_written_keys(storage):
    for key in ("a", "b/c"):
        with storage.open(key, "wb") as f:
            f.write(b"x")
    assert set(storage.list()) == {"a", "b/c"}


def test_delete_removes_the_object(storage):
    with storage.open("gone", "wb") as f:
        f.write(b"x")
    storage.delete("gone")
    assert storage.exists("gone") is False


def test_open_rejects_unknown_mode(storage):
    with pytest.raises(ValueError):
        with storage.open("k", "ab"):
            pass
