#!/usr/bin/env python3
"""
Deploy sunnylink-wiki to Cloud Run via Cloud Build.

Usage:
    python3 scripts/deploy.py

Required environment variables:
    GOOGLE_APPLICATION_CREDENTIALS  Path to GCP service account JSON key file
    GCP_PROJECT_ID                  GCP project ID (default: sunnylink-wiki)

Optional environment variables:
    GCP_REGION                      Cloud Run region (default: us-central1)
    NEXT_PUBLIC_GOOGLE_SCRIPT_URL   Google Apps Script URL
    GIT_BRANCH                      Branch to build from (default: current branch)
"""

import os
import sys
import subprocess
import time

from google.cloud.devtools import cloudbuild_v1
from google.oauth2 import service_account

PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "sunnylink-wiki")
REGION = os.environ.get("GCP_REGION", "us-central1")
GOOGLE_SCRIPT_URL = os.environ.get("NEXT_PUBLIC_GOOGLE_SCRIPT_URL", "")
REPO_NAME = "sunnylink-wiki"


def _get_current_branch():
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, check=True,
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        return result.stdout.strip()
    except Exception:
        return "main"


BRANCH = os.environ.get("GIT_BRANCH") or _get_current_branch()


def _get_credentials():
    key_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not key_file:
        print("ERROR: GOOGLE_APPLICATION_CREDENTIALS is not set.")
        print("Set it to the path of your GCP service account JSON key file.")
        sys.exit(1)
    if not os.path.exists(key_file):
        print(f"ERROR: Key file not found: {key_file}")
        sys.exit(1)
    return service_account.Credentials.from_service_account_file(
        key_file,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )


def _build_config():
    image_base = f"gcr.io/{PROJECT_ID}/wiki-app"
    return cloudbuild_v1.Build(
        steps=[
            cloudbuild_v1.BuildStep(
                name="gcr.io/cloud-builders/docker",
                args=[
                    "build",
                    "-t", f"{image_base}:$COMMIT_SHA",
                    "-t", f"{image_base}:latest",
                    "--build-arg", f"NEXT_PUBLIC_GOOGLE_SCRIPT_URL={GOOGLE_SCRIPT_URL}",
                    ".",
                ],
            ),
            cloudbuild_v1.BuildStep(
                name="gcr.io/cloud-builders/docker",
                args=["push", "--all-tags", image_base],
            ),
            cloudbuild_v1.BuildStep(
                name="gcr.io/google.com/cloudsdktool/cloud-sdk",
                entrypoint="gcloud",
                args=[
                    "run", "deploy", "wiki-app",
                    "--image", f"{image_base}:$COMMIT_SHA",
                    "--region", REGION,
                    "--platform", "managed",
                    "--allow-unauthenticated",
                    "--port", "3000",
                    "--memory", "512Mi",
                    "--min-instances", "0",
                    "--max-instances", "3",
                    "--set-env-vars",
                    f"NEXT_PUBLIC_GOOGLE_SCRIPT_URL={GOOGLE_SCRIPT_URL}",
                ],
            ),
        ],
        source=cloudbuild_v1.Source(
            repo_source=cloudbuild_v1.RepoSource(
                project_id=PROJECT_ID,
                repo_name=REPO_NAME,
                branch_name=BRANCH,
            )
        ),
        images=[f"{image_base}:$COMMIT_SHA", f"{image_base}:latest"],
        options=cloudbuild_v1.BuildOptions(logging="CLOUD_LOGGING_ONLY"),
    )


def deploy():
    branch = _get_current_branch() if not os.environ.get("GIT_BRANCH") else BRANCH
    print(f"Deploying branch '{branch}' to Cloud Run ({REGION})...")
    print(f"Project: {PROJECT_ID}")

    credentials = _get_credentials()
    client = cloudbuild_v1.CloudBuildClient(credentials=credentials)

    operation = client.create_build(project_id=PROJECT_ID, build=_build_config())
    build_id = operation.metadata.build.id
    print(f"\nBuild started: {build_id}")
    print(f"Logs: https://console.cloud.google.com/cloud-build/builds/{build_id}?project={PROJECT_ID}\n")

    # Poll for completion
    while True:
        build = client.get_build(project_id=PROJECT_ID, id=build_id)
        status = cloudbuild_v1.Build.Status(build.status)
        status_name = status.name

        if status_name in ("SUCCESS", "FAILURE", "CANCELLED", "TIMEOUT", "INTERNAL_ERROR"):
            break

        print(f"  Status: {status_name} — waiting...")
        time.sleep(15)

    if status_name == "SUCCESS":
        print(f"\nDeploy successful!")
        print(f"Service URL: https://wiki-app-<hash>-{REGION[:2]}.a.run.app")
        print(f"(Check Cloud Run console for the exact URL)")
    else:
        print(f"\nDeploy failed with status: {status_name}")
        print(f"Check logs: https://console.cloud.google.com/cloud-build/builds/{build_id}?project={PROJECT_ID}")
        sys.exit(1)


if __name__ == "__main__":
    deploy()
