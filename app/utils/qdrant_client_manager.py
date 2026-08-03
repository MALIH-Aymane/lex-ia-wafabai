# qdrant_client_manager.py  ← ARCHIVED / NO LONGER USED
#
# This file has been superseded by utils/chroma_client_manager.py
# as part of the migration from cloud-hosted Qdrant to local ChromaDB.
#
# Kept for reference only. Do NOT import this file.
#
# import qdrant_client
#
# def create_qdrant_client():
#     client = qdrant_client.QdrantClient(
#         timeout=300,
#         url="https://bf36cc1d-2576-4bc3-86cb-23d16f3d403a.eu-west-2-0.aws.cloud.qdrant.io:6333",
#         api_key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.1G8qcJji12xFbsA7luQfZIvvBZea_Hxgl4R91EvVDo8",
#     )
#     return client