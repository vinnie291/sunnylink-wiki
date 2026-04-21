#!/usr/bin/env python3
"""
Deploy sunnylink-wiki to Cloud Run via Cloud Build (source upload).

Usage:
    python3 scripts/deploy.py

Credentials: /home/user/.config/gcp/sunnylink-wiki-key.json
"""

import json
import os
import subprocess
import sys
import tarfile
import tempfile
import time

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

KEY_FILE = "/home/user/.config/gcp/sunnylink-wiki-key.json"
PROJECT_ID = "sunnylink-wiki"
REGION = os.environ.get("GCP_REGION", "us-central1")
GOOGLE_SCRIPT_URL = os.environ.get("NEXT_PUBLIC_GOOGLE_SCRIPT_URL", "")
GCS_BUCKET = f"{PROJECT_ID}_cloudbuild"
BASE_URL = f"https://cloudbuild.googleapis.com/v1/projects/{PROJECT_ID}"

EXCLUDE = {
    "node_modules", ".git", ".next", "out", ".env", ".env.local",
    "__pycache__", ".DS_Store",
}


def _get_token():
    creds = service_account.Credentials.from_service_account_file(
        KEY_FILE, scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    creds.refresh(Request())
    return creds.token


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _make_tarball(repo_root, dest):
    def _filter(info):
        parts = info.name.split("/")
        if any(p in EXCLUDE for p in parts):
            return None
        return info

    with tarfile.open(dest, "w:gz") as tar:
        tar.add(repo_root, arcname=".", filter=_filter)
    size_mb = os.path.getsize(dest) / 1024 / 1024
    print(f"  Source tarball: {size_mb:.1f} MB")


def _upload_to_gcs(token, tarball_path, object_name):
    url = (
        f"https://storage.googleapis.com/upload/storage/v1"
        f"/b/{GCS_BUCKET}/o?uploadType=media&name={object_name}"
    )
    with open(tarball_path, "rb") as f:
        resp = requests.post(
            url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/gzip"},
            data=f,
        )
    if resp.status_code not in (200, 201):
        print(f"GCS upload failed: {resp.status_code} {resp.text[:300]}")
        sys.exit(1)
    generation = resp.json().get("generation")
    print(f"  Uploaded to gs://{GCS_BUCKET}/{object_name} (gen {generation})")
    return generation


def deploy():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    timestamp = int(time.time())
    object_name = f"source/sunnylink-wiki-{timestamp}.tar.gz"
    image = f"gcr.io/{PROJECT_ID}/wiki-app"
    image_tag = f"{image}:{timestamp}"

    print(f"Deploying sunnylink-wiki → Cloud Run ({REGION})")
    print(f"Project: {PROJECT_ID}\n")

    token = _get_token()

    # 1. Package source
    print("Packaging source...")
    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tarball = tmp.name
    _make_tarball(repo_root, tarball)

    # 2. Upload to GCS
    print("Uploading to Cloud Storage...")
    generation = _upload_to_gcs(token, tarball, object_name)
    os.unlink(tarball)

    # 3. Trigger build
    print("Starting Cloud Build...\n")
    token = _get_token()
    build_body = {
        "source": {
            "storageSource": {
                "bucket": GCS_BUCKET,
                "object": object_name,
                "generation": generation,
            }
        },
        "steps": [
            {
                "name": "gcr.io/cloud-builders/docker",
                "args": [
                    "build",
                    "--no-cache",
                    "-t", image_tag,
                    "-t", f"{image}:latest",
                    "--build-arg", f"NEXT_PUBLIC_GOOGLE_SCRIPT_URL={GOOGLE_SCRIPT_URL}",
                    ".",
                ],
            },
            {
                "name": "gcr.io/cloud-builders/docker",
                "args": ["push", "--all-tags", image],
            },
            {
                "name": "gcr.io/google.com/cloudsdktool/cloud-sdk",
                "entrypoint": "gcloud",
                "args": [
                    "run", "deploy", "wiki-app",
                    "--image", image_tag,
                    "--region", REGION,
                    "--platform", "managed",
                    "--allow-unauthenticated",
                    "--port", "3000",
                    "--memory", "512Mi",
                    "--min-instances", "0",
                    "--max-instances", "3",
                ],
            },
        ],
        "images": [image_tag, f"{image}:latest"],
        "options": {"logging": "CLOUD_LOGGING_ONLY"},
    }

    resp = requests.post(
        f"{BASE_URL}/builds",
        headers=_headers(token),
        json=build_body,
    )

    if resp.status_code not in (200, 201):
        print(f"Failed to start build: {resp.status_code}\n{resp.text}")
        sys.exit(1)

    build_id = resp.json()["metadata"]["build"]["id"]
    print(f"Build ID: {build_id}")
    print(f"Logs:     https://console.cloud.google.com/cloud-build/builds/{build_id}?project={PROJECT_ID}\n")

    # 4. Poll
    terminal = {"SUCCESS", "FAILURE", "CANCELLED", "TIMEOUT", "INTERNAL_ERROR"}
    last_status = ""
    while True:
        token = _get_token()
        r = requests.get(f"{BASE_URL}/builds/{build_id}", headers=_headers(token))
        status = r.json().get("status", "UNKNOWN")
        if status != last_status:
            print(f"  → {status}")
            last_status = status
        if status in terminal:
            break
        time.sleep(20)

    if status == "SUCCESS":
        print(f"\nDeploy successful!")
        print(f"Cloud Run: https://console.cloud.google.com/run?project={PROJECT_ID}")
    else:
        print(f"\nDeploy failed: {status}")
        print(f"Logs: https://console.cloud.google.com/cloud-build/builds/{build_id}?project={PROJECT_ID}")
        sys.exit(1)


if __name__ == "__main__":
    deploy()
