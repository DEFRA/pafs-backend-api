#!/bin/bash

# S3 buckets
aws s3 mb s3://dev-pafs-assets-c63f2

# SQS queues
aws sqs create-queue --queue-name pafs_programme_generation
aws sqs create-queue --queue-name pafs_external_submission
