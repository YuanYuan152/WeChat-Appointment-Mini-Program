from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from assessment_definition_service import (
    AssessmentConflict,
    AssessmentDefinitionStore,
    AssessmentNotFound,
    AssessmentValidationError,
)


BACKEND_DIR = Path(__file__).resolve().parent
REPOSITORY_DIR = BACKEND_DIR.parent


class AssessmentDefinitionStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temporary.name) / "assessment-data"
        self.store = AssessmentDefinitionStore(
            self.data_dir,
            seed_data_dir=REPOSITORY_DIR / "EAP_front_site" / "src" / "data",
            guidance_file=(
                REPOSITORY_DIR
                / "EAP_front_site"
                / "src"
                / "lib"
                / "assessment"
                / "scale-guidance.ts"
            ),
            report_profiles_file=BACKEND_DIR / "assessment_seed_report_profiles.json",
        )
        self.store.ensure_seeded()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    @staticmethod
    def example_definition(name: str = "professional-dimension.json") -> dict:
        path = REPOSITORY_DIR / "docs" / "assessment" / "examples" / name
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)

    def test_legacy_eap_json_is_seeded_as_six_runtime_definitions(self) -> None:
        items = self.store.list_published()
        self.assertEqual(6, len(items))
        self.assertEqual(5, len(self.store.list_published(category="professional")))
        self.assertEqual(1, len(self.store.list_published(category="fun")))
        self.assertTrue((self.data_dir / "index.json").exists())
        for item in items:
            seeded = self.store.get_published(item["id"])["definition"]
            self.assertTrue(seeded.get("instructions"), item["id"])

        self.assertTrue(self.store.get_published("pbi")["definition"]["reportProfiles"])
        self.assertTrue(self.store.get_published("cbcl")["definition"]["reportProfiles"])

        dark = self.store.get_published("dark-light-personality")
        definition = dark["definition"]
        self.assertEqual(12, dark["questionCount"])
        self.assertEqual(12, len(definition["questions"]))
        self.assertNotIn("questionCount", definition)
        self.assertEqual("dark-light-v1", definition["scoringPreset"])
        self.assertIn("黑暗三联征", definition["instructions"])
        self.assertGreaterEqual(len(definition["reportProfiles"]), 13)
        self.assertTrue(all(question["required"] for question in definition["questions"]))

    def test_draft_revision_publish_archive_and_restore_workflow(self) -> None:
        created = self.store.create_draft(self.example_definition())
        first_revision = created["revision"]
        self.assertEqual(1, created["draftVersion"])

        changed = copy.deepcopy(created["definition"])
        changed["title"] = "幸福感演示量表 v1"
        updated = self.store.update_draft(
            "wellbeing-demo",
            changed,
            expected_revision=first_revision,
        )
        self.assertNotEqual(first_revision, updated["revision"])
        self.assertTrue(any((self.data_dir / "backups" / "wellbeing-demo").iterdir()))

        with self.assertRaises(AssessmentConflict):
            self.store.update_draft(
                "wellbeing-demo",
                changed,
                expected_revision=first_revision,
            )

        published_v1 = self.store.publish(
            "wellbeing-demo",
            expected_revision=updated["revision"],
        )
        self.assertEqual(1, published_v1["publishedVersion"])
        self.assertIsNone(published_v1["draftVersion"])
        self.assertEqual(
            "幸福感演示量表 v1",
            self.store.get_published("wellbeing-demo")["definition"]["title"],
        )

        editable = self.store.get_admin("wellbeing-demo")
        changed_v2 = copy.deepcopy(editable["definition"])
        changed_v2["title"] = "幸福感演示量表 v2"
        draft_v2 = self.store.update_draft(
            "wellbeing-demo",
            changed_v2,
            expected_revision=editable["revision"],
        )
        self.assertEqual(2, draft_v2["draftVersion"])
        self.assertEqual(
            "幸福感演示量表 v1",
            self.store.get_published("wellbeing-demo")["definition"]["title"],
        )
        published_v2 = self.store.publish(
            "wellbeing-demo",
            expected_revision=draft_v2["revision"],
        )
        self.assertEqual([2, 1], [item["version"] for item in published_v2["versions"]])

        with (
            self.data_dir / "published" / "wellbeing-demo" / "v1.json"
        ).open(encoding="utf-8") as handle:
            immutable_v1 = json.load(handle)
        self.assertEqual("幸福感演示量表 v1", immutable_v1["title"])

        self.store.archive("wellbeing-demo")
        with self.assertRaises(AssessmentNotFound):
            self.store.get_published("wellbeing-demo")

        restored = self.store.restore_version("wellbeing-demo", 1)
        self.assertEqual(3, restored["draftVersion"])
        self.assertEqual("幸福感演示量表 v1", restored["definition"]["title"])
        self.assertEqual("draft", restored["definition"]["status"])

    def test_admin_pagination_keyword_and_status_filters(self) -> None:
        result = self.store.list_admin(
            page=1,
            page_size=2,
            category="professional",
            status="published",
            keyword="睡眠",
        )
        self.assertEqual(1, result["total"])
        self.assertEqual("psqi", result["items"][0]["id"])
        self.assertEqual(0, result["items"][0]["completedCount"])

    def test_invalid_dimension_reference_is_rejected(self) -> None:
        definition = self.example_definition()
        definition["id"] = "broken-reference"
        definition["dimensions"][0]["questionIds"] = ["missing-question"]
        with self.assertRaises(AssessmentValidationError):
            self.store.create_draft(definition)

    def test_new_definition_cannot_select_fixed_scoring_preset(self) -> None:
        definition = self.example_definition()
        definition["id"] = "fixed-preset-not-allowed"
        definition["scoringType"] = "pbi"
        definition["scoringPreset"] = "pbi-v1"
        definition.pop("dimensions")
        with self.assertRaises(AssessmentValidationError):
            self.store.create_draft(definition)

    def test_fixed_scoring_definition_cannot_drop_required_question(self) -> None:
        current = self.store.get_admin("pbi")
        changed = copy.deepcopy(current["definition"])
        changed["questions"] = changed["questions"][:-1]
        with self.assertRaises(AssessmentValidationError):
            self.store.update_draft(
                "pbi",
                changed,
                expected_revision=current["revision"],
            )


if __name__ == "__main__":
    unittest.main()
