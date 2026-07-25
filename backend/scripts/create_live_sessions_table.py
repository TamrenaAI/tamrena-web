"""
One-off setup script: creates the `workout_live_sessions` DynamoDB table
this service owns for real Live Session results. Run once per AWS
account/environment from the `backend/` directory (so app.config's
dotenv loading finds .env) — safe to re-run, skips if the table already
exists.

Usage: python scripts/create_live_sessions_table.py
"""

import boto3
from botocore.exceptions import ClientError

from app.config import AWS_REGION, LIVE_SESSIONS_TABLE_NAME


def main() -> None:
    client = boto3.client("dynamodb", region_name=AWS_REGION)
    try:
        client.describe_table(TableName=LIVE_SESSIONS_TABLE_NAME)
        print(f"Table '{LIVE_SESSIONS_TABLE_NAME}' already exists — nothing to do.")
        return
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ResourceNotFoundException":
            raise

    client.create_table(
        TableName=LIVE_SESSIONS_TABLE_NAME,
        KeySchema=[{"AttributeName": "session_id", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "session_id", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )
    print(f"Created table '{LIVE_SESSIONS_TABLE_NAME}'.")


if __name__ == "__main__":
    main()
