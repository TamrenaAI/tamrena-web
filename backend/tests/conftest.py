"""
Shared pytest fixtures. `dynamo_table` (autouse) gives every test an
isolated in-memory DynamoDB via moto, matching the real tables' schemas —
workout_users (PK user_id, GSI username-index on username) and
workout_live_sessions (PK session_id, no GSI) — so no test ever touches
the real AWS tables.
"""

import boto3
import pytest
from moto import mock_aws

import app.db as db_module
from app.config import AWS_REGION, DYNAMODB_TABLE_NAME, LIVE_SESSIONS_TABLE_NAME


@pytest.fixture(autouse=True)
def dynamo_table():
    with mock_aws():
        db_module._resource = None  # force get_resource() to rebuild inside the mock
        resource = boto3.resource("dynamodb", region_name=AWS_REGION)
        resource.create_table(
            TableName=DYNAMODB_TABLE_NAME,
            KeySchema=[{"AttributeName": "user_id", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "user_id", "AttributeType": "S"},
                {"AttributeName": "username", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "username-index",
                    "KeySchema": [{"AttributeName": "username", "KeyType": "HASH"}],
                    "Projection": {"ProjectionType": "ALL"},
                    "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
                }
            ],
            ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
        )
        resource.create_table(
            TableName=LIVE_SESSIONS_TABLE_NAME,
            KeySchema=[{"AttributeName": "session_id", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "session_id", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        yield resource
        db_module._resource = None  # don't leak the mock resource into the next test
