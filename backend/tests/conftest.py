"""
Shared pytest fixtures. `dynamo_table` (autouse) gives every test an
isolated in-memory DynamoDB via moto, matching the real `workout_users`
table's schema (PK user_id, GSI username-index on username), so no test
ever touches the real AWS table.
"""

import boto3
import pytest
from moto import mock_aws

import app.db as db_module
from app.config import AWS_REGION, DYNAMODB_TABLE_NAME


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
        yield resource
        db_module._resource = None  # don't leak the mock resource into the next test
