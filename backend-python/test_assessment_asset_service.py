from __future__ import annotations

import asyncio
import hashlib
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from PIL import Image

import assessment_asset_service as asset_service
from assessment_asset_service import (
    AssessmentAssetReferenceError,
    GENERIC_IMAGE_MAX_BYTES,
    ImageUploadError,
    inspect_image,
    is_safe_assessment_asset_reference,
    read_image_upload,
    save_assessment_uploaded_image,
    save_generic_uploaded_image,
    validate_assessment_asset_reference,
)
from config import settings


def image_bytes(image_format: str, width: int, height: int) -> bytes:
    output = BytesIO()
    mode = "P" if image_format == "GIF" else "RGB"
    image = Image.new(mode, (width, height), color=1)
    image.save(output, format=image_format)
    return output.getvalue()


def png_bytes(width: int = 2, height: int = 3) -> bytes:
    return image_bytes("PNG", width, height)


def jpeg_bytes(width: int = 4, height: int = 5) -> bytes:
    return image_bytes("JPEG", width, height)


def webp_bytes(width: int = 6, height: int = 7) -> bytes:
    return image_bytes("WEBP", width, height)


def gif_bytes(width: int = 8, height: int = 9) -> bytes:
    return image_bytes("GIF", width, height)


class FakeUpload:
    def __init__(self, content: bytes):
        self.content = content
        self.position = 0
        self.closed = False

    async def read(self, size: int) -> bytes:
        chunk = self.content[self.position : self.position + size]
        self.position += len(chunk)
        return chunk

    async def close(self) -> None:
        self.closed = True


class AssessmentAssetServiceTests(unittest.TestCase):
    def test_inspect_image_uses_file_signature_and_real_dimensions(self) -> None:
        png = inspect_image(png_bytes())
        jpeg = inspect_image(jpeg_bytes())
        webp = inspect_image(webp_bytes())
        gif = inspect_image(gif_bytes())

        self.assertEqual(("png", ".png", 2, 3), (png.format, png.extension, png.width, png.height))
        self.assertEqual(
            ("jpeg", ".jpg", 4, 5),
            (jpeg.format, jpeg.extension, jpeg.width, jpeg.height),
        )
        self.assertEqual(
            ("webp", ".webp", 6, 7),
            (webp.format, webp.extension, webp.width, webp.height),
        )
        self.assertEqual(("gif", 8, 9), (gif.format, gif.width, gif.height))

    def test_assessment_upload_rejects_gif_html_and_unsafe_dimensions(self) -> None:
        with self.assertRaisesRegex(ImageUploadError, "JPEG、PNG、WEBP"):
            inspect_image(
                gif_bytes(),
                allowed_formats={"jpeg", "png", "webp"},
            )
        with self.assertRaisesRegex(ImageUploadError, "有效"):
            inspect_image(b"<html>not an image</html>")
        with self.assertRaisesRegex(ImageUploadError, "完整"):
            inspect_image(png_bytes() + b"<html>appended content</html>")
        with self.assertRaisesRegex(ImageUploadError, "尺寸"):
            inspect_image(png_bytes(width=6_001, height=1))

    def test_stream_reader_enforces_limit_and_always_closes_upload(self) -> None:
        upload = FakeUpload(png_bytes())
        content, info = asyncio.run(
            read_image_upload(
                upload,
                max_bytes=1024,
                allowed_formats={"png"},
            )
        )
        self.assertEqual(png_bytes(), content)
        self.assertEqual("png", info.format)
        self.assertTrue(upload.closed)

        oversized = FakeUpload(b"x" * 6)
        with self.assertRaisesRegex(ImageUploadError, "图片大小不能超过"):
            asyncio.run(
                read_image_upload(
                    oversized,
                    max_bytes=5,
                    allowed_formats={"png"},
                )
            )
        self.assertTrue(oversized.closed)

        empty = FakeUpload(b"")
        with self.assertRaisesRegex(ImageUploadError, "不能为空"):
            asyncio.run(
                read_image_upload(
                    empty,
                    max_bytes=5,
                    allowed_formats={"png"},
                )
            )
        self.assertTrue(empty.closed)

    def test_assessment_assets_are_content_addressed_and_immutable(self) -> None:
        content = png_bytes()
        info = inspect_image(content, allowed_formats={"png"})
        expected_filename = f"{hashlib.sha256(content).hexdigest()}.png"

        with tempfile.TemporaryDirectory() as temporary:
            asset_dir = Path(temporary) / "assessment-assets"
            with (
                patch.object(asset_service, "ASSESSMENT_ASSET_DIR", asset_dir),
                patch.object(settings, "BASE_URL", "https://api.example.test/"),
            ):
                first = save_assessment_uploaded_image(content, info)
                second = save_assessment_uploaded_image(content, info)

            self.assertEqual(expected_filename, first["filename"])
            self.assertEqual(first, second)
            self.assertEqual(
                f"/static/assessment-assets/{expected_filename}",
                first["path"],
            )
            self.assertEqual(
                f"https://api.example.test/static/assessment-assets/{expected_filename}",
                first["url"],
            )
            self.assertEqual(content, (asset_dir / expected_filename).read_bytes())
            self.assertEqual([expected_filename], [item.name for item in asset_dir.iterdir()])

    def test_generic_upload_keeps_response_contract_with_canonical_extension(self) -> None:
        content = jpeg_bytes()
        info = inspect_image(content)
        with tempfile.TemporaryDirectory() as temporary:
            upload_dir = Path(temporary) / "uploads"
            with (
                patch.object(asset_service, "UPLOAD_DIR", upload_dir),
                patch.object(settings, "BASE_URL", "https://api.example.test"),
            ):
                result = save_generic_uploaded_image(content, info)

            self.assertTrue(result["filename"].endswith(".jpg"))
            self.assertEqual(
                f"https://api.example.test/static/uploads/{result['filename']}",
                result["url"],
            )
            self.assertEqual(content, (upload_dir / result["filename"]).read_bytes())

    def test_generic_upload_preserves_existing_large_dimension_contract(self) -> None:
        content = jpeg_bytes(width=7_000, height=1)
        upload = FakeUpload(content)
        stored_content, info = asyncio.run(
            read_image_upload(
                upload,
                max_bytes=GENERIC_IMAGE_MAX_BYTES,
                allowed_formats={"jpeg", "png", "webp", "gif"},
                enforce_dimension_limits=False,
                load_pixels=False,
            )
        )
        self.assertEqual(content, stored_content)
        self.assertEqual((7_000, 1), (info.width, info.height))

    def test_asset_reference_allowlist(self) -> None:
        digest = "a" * 64
        accepted = [
            "/images/content/assess/cover.jpg",
            "/images/content/result.GIF",
            "/static/assessments/demo.png",
            f"/static/assessment-assets/{digest}.webp",
        ]
        rejected = [
            "",
            " /images/content/cover.jpg",
            "data:image/png;base64,AAAA",
            "blob:https://example.test/id",
            "javascript:alert(1)",
            "//example.test/image.png",
            "https://example.test/image.png",
            "/images/../secret.png",
            "/images/%2e%2e/secret.png",
            "/images/content/cover.svg",
            "/images/content/cover.jpg?token=secret",
            "/images/content/cover.jpg#fragment",
            "/images//content/cover.jpg",
            '/images/content/cover");evil=".jpg',
            "/static/assessment-assets/not-a-digest.png",
            f"/static/assessment-assets/{digest}.gif",
            "/images/" + ("a" * 500) + ".png",
        ]

        for value in accepted:
            with self.subTest(value=value):
                self.assertTrue(is_safe_assessment_asset_reference(value))
                validate_assessment_asset_reference(value, "image", allow_empty=False)

        for value in rejected:
            with self.subTest(value=value):
                self.assertFalse(is_safe_assessment_asset_reference(value))
                with self.assertRaises(AssessmentAssetReferenceError):
                    validate_assessment_asset_reference(value, "image", allow_empty=False)

        validate_assessment_asset_reference("", "image", allow_empty=True)


if __name__ == "__main__":
    unittest.main()
