import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import assessment_audio_service as service
import assessment_enterprise_service


class AssessmentAudioServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.enterprises_path = root / "enterprises.json"
        self.audios_path = root / "audios.json"
        self.enterprises_path.write_text("[]", encoding="utf-8")
        self.data_path_patch = patch.object(
            assessment_enterprise_service,
            "_data_path",
            return_value=self.enterprises_path,
        )
        self.data_path_patch.start()

    def tearDown(self):
        self.data_path_patch.stop()
        self.tmp.cleanup()

    def test_shared_default_and_enterprise_isolation(self):
        shared = service.create_shared_audio(
            {
                "title": "通用呼吸练习",
                "audioUrl": "https://example.com/a.mp3",
                "description": "三分钟呼吸",
                "series": "情绪调节",
                "duration": "3 分钟",
            }
        )
        enterprise = assessment_enterprise_service.save_enterprise(
            enterprise_id=None,
            company_name="甲公司",
            url="https://example.com/abcdefghijabcdefghij12",
            assessment_ids=["scale-1"],
            site_name="甲站",
            logo_url="/logo.png",
            slogan="口号",
        )
        enterprise_id = enterprise["id"]

        overridden = service.update_enterprise_audio(
            enterprise_id,
            shared["id"],
            {
                "title": "甲公司定制标题",
                "audioUrl": "https://example.com/a.mp3",
                "description": "三分钟呼吸",
                "series": "情绪调节",
                "duration": "3 分钟",
            },
        )
        self.assertEqual(overridden["source"], "override")
        self.assertEqual(overridden["title"], "甲公司定制标题")

        def find_title(audio_id: str) -> str:
            return next(
                item["title"]
                for item in service.list_enterprise_audios(enterprise_id)
                if item["id"] == audio_id
            )

        # 不覆盖：通用改了，企业改稿仍在
        updated = service.update_shared_audio(
            shared["id"],
            {
                "title": "通用新标题",
                "audioUrl": "https://example.com/a.mp3",
                "description": "三分钟呼吸",
                "series": "情绪调节",
                "duration": "3 分钟",
            },
            overwrite_enterprise_overrides=False,
        )
        self.assertTrue(updated["needsOverwriteConfirm"])
        self.assertEqual(updated["affectedEnterpriseCount"], 1)
        self.assertEqual(find_title(shared["id"]), "甲公司定制标题")

        # 覆盖：同步通用内容到企业改稿
        synced = service.update_shared_audio(
            shared["id"],
            {
                "title": "通用新标题",
                "audioUrl": "https://example.com/a.mp3",
                "description": "三分钟呼吸",
                "series": "情绪调节",
                "duration": "3 分钟",
            },
            overwrite_enterprise_overrides=True,
        )
        self.assertFalse(synced["needsOverwriteConfirm"])
        self.assertEqual(find_title(shared["id"]), "通用新标题")

        # 企业本地新增不影响通用
        local = service.create_enterprise_audio(
            enterprise_id,
            {
                "title": "仅甲公司",
                "audioUrl": "https://example.com/b.mp3",
                "description": "专属",
                "duration": "5 分钟",
            },
        )
        self.assertTrue(local["id"].startswith("local-audio-"))
        shared_ids = {item["id"] for item in service.list_shared_audios()}
        self.assertNotIn(local["id"], shared_ids)

        # 企业改通用条目不写回通用库
        service.update_enterprise_audio(
            enterprise_id,
            shared["id"],
            {
                "title": "再次定制",
                "audioUrl": "https://example.com/a.mp3",
                "description": "三分钟呼吸",
                "duration": "3 分钟",
            },
        )
        shared_again = next(item for item in service.list_shared_audios() if item["id"] == shared["id"])
        self.assertEqual(shared_again["title"], "通用新标题")

    def test_seed_file_loads(self):
        self.assertTrue(service._seed_path().exists())
        items = json.loads(service._seed_path().read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(items), 1)


if __name__ == "__main__":
    unittest.main()
