"""Run the local full-stack API suite against a newly isolated Mongo database."""
import argparse
import os
import subprocess
import sys
import uuid
from urllib.parse import urlsplit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--keep-db",
        action="store_true",
        help="Keep the uniquely named local database after the test run for manual browser review.",
    )
    args = parser.parse_args()

    mongo_url = "mongodb://127.0.0.1:27017"
    database_name = os.environ.get(
        "NIVARA_E2E_DB_NAME", f"nivara_e2e_{uuid.uuid4().hex[:12]}"
    )
    if urlsplit(mongo_url).hostname not in {"localhost", "127.0.0.1", "::1"}:
        parser.error("The test runner only supports loopback MongoDB.")
    if not database_name.startswith("nivara_e2e_"):
        parser.error("The disposable test database name must start with 'nivara_e2e_'.")

    env = os.environ.copy()
    env.update({
        "APP_ENV": "development",
        "MONGO_URL": mongo_url,
        "DB_NAME": database_name,
        "JWT_SECRET": f"local-e2e-only-{uuid.uuid4().hex}-{uuid.uuid4().hex}",
        "ADMIN_EMAIL": "qa@nivara.local",
        "ADMIN_PASSWORD": "LocalE2E-Only-2026!",
        "ADMIN_NAME": "Local E2E QA",
        "LOSSES_PASSWORD": "LocalE2E-Only-2026!",
        "NIVARA_E2E_DEMO": "true",
        "NIVARA_LOCAL_E2E": "1",
        "NIVARA_E2E_KEEP_DB": "1" if args.keep_db else "0",
    })
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "test_00_e2e_workspace.py"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        env=env,
        check=False,
    )

    if args.keep_db:
        print(f"Local E2E workspace retained: {database_name}")
    else:
        from pymongo import MongoClient

        local_mongo = MongoClient(mongo_url, serverSelectionTimeoutMS=2000)
        try:
            local_mongo.admin.command("ping")
            local_mongo.drop_database(database_name)
            print(f"Removed disposable local E2E database: {database_name}")
        except Exception as exc:
            print(f"Could not clean up disposable database: {type(exc).__name__}", file=sys.stderr)
            if result.returncode == 0:
                return 1
        finally:
            local_mongo.close()
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
