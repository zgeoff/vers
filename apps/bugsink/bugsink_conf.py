"""
Bugsink settings for the vers deployment: the stock Docker config plus one
override. The base image ships its Docker config template at
/app/bugsink_conf.py; our Dockerfile preserves it as bugsink_conf_base so we
inherit every env-driven setting and only add R2 as the ``file`` write storage.
Keeping the base by import (not copy) means a bugsink bump needs no edit here.

When R2_BUCKET is set, uploaded files (sourcemap artifact bundles) are written
to Cloudflare R2 instead of the Postgres row, keeping the shared Neon database
free of large blobs. Without it, the image falls back to the stock DB storage.
"""

import os

from bugsink_conf_base import *  # noqa: F401,F403
from bugsink_conf_base import BUGSINK

if os.getenv("R2_BUCKET"):
    BUGSINK["OBJECT_STORAGES"] = {
        "file": {
            "r2": {
                "STORAGE": "r2_storage.R2ObjectStorage",
                "OPTIONS": {},
                "USE_FOR_WRITE": True,
            },
        },
    }
