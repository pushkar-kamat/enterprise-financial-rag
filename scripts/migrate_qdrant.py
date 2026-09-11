import os

from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

load_dotenv()

COLLECTION_NAME = "financial_policies"
BATCH_SIZE = 50

# Local Qdrant
local_client = QdrantClient(
    path="data/processed/vector_store/qdrant"
)

# Qdrant Cloud
cloud_client = QdrantClient(
    url=os.environ["QDRANT_URL"],
    api_key=os.environ["QDRANT_API_KEY"],
)

# Read local collection configuration
local_info = local_client.get_collection(COLLECTION_NAME)

vector_size = local_info.config.params.vectors.size
distance = local_info.config.params.vectors.distance

print("Local collection:")
print("Vectors:", local_info.points_count)
print("Vector size:", vector_size)
print("Distance:", distance)

# Create cloud collection
if not cloud_client.collection_exists(COLLECTION_NAME):
    cloud_client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config={
            "size": vector_size,
            "distance": distance,
        },
    )
    print("Created cloud collection.")
else:
    print("Cloud collection already exists.")

# Read points from local Qdrant
offset = None
total_migrated = 0

while True:
    points, offset = local_client.scroll(
        collection_name=COLLECTION_NAME,
        limit=BATCH_SIZE,
        offset=offset,
        with_payload=True,
        with_vectors=True,
    )

    if not points:
        break

    cloud_points = []

    for point in points:
        cloud_points.append(
            PointStruct(
                id=point.id,
                vector=point.vector,
                payload=point.payload,
            )
        )

    cloud_client.upsert(
        collection_name=COLLECTION_NAME,
        points=cloud_points,
        wait=True,
    )

    total_migrated += len(cloud_points)

    print(f"Migrated: {total_migrated}")

    if offset is None:
        break

print()
print("Migration complete.")

cloud_info = cloud_client.get_collection(COLLECTION_NAME)

print("Cloud vectors:", cloud_info.points_count)

local_client.close()
cloud_client.close()