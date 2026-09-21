from pathlib import Path

from backend.storage import delete_file, file_exists, upload_file


TEST_FILE = Path("/tmp/northstar-s3-python-test.txt")
TEST_KEY = "tests/northstar-s3-python-test.txt"


TEST_FILE.write_text(
    "Northstar Python S3 integration test",
    encoding="utf-8",
)

print("Uploading test file...")

upload_file(
    file_path=TEST_FILE,
    storage_key=TEST_KEY,
    content_type="text/plain",
)

print("Upload successful.")

print("Checking whether the object exists...")

exists = file_exists(TEST_KEY)

print(f"File exists: {exists}")

if not exists:
    raise RuntimeError("S3 object was not found after upload.")

delete_file(TEST_KEY)

print("Temporary S3 object deleted.")

print("S3 storage test passed.")
