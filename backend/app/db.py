"""
Shared DynamoDB client — this service's OWN table, never Tamreena_AI's.
"""

from typing import Optional

import boto3

from app.config import AWS_REGION, DYNAMODB_TABLE_NAME

_resource: Optional["boto3.resources.base.ServiceResource"] = None


def get_resource():
    global _resource
    if _resource is None:
        _resource = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _resource


def get_users_table():
    return get_resource().Table(DYNAMODB_TABLE_NAME)
