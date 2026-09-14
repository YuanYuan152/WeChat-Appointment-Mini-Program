import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from common import common_banners
from database import Base
from models import AppActivity, AppBanner
from ops import ActivityCreate, BannerCreate, create_activity, create_banner


class ContentLiveModeTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(
            self.engine,
            tables=[AppActivity.__table__, AppBanner.__table__],
        )
        self.db = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_live_display_modes_and_icons_round_trip(self):
        calendar = create_activity(
            ActivityCreate(
                type="LIVE",
                title="九月直播日历",
                content="整月直播安排",
                cover_url="/uploads/calendar.png",
                live_display_mode="CALENDAR",
            ),
            object(),
            self.db,
        )
        channels = create_activity(
            ActivityCreate(
                type="LIVE",
                title="关注视频号",
                live_display_mode="CHANNELS",
                jixinli_icon_url="/uploads/jixinli.png",
                tongxinli_icon_url="/uploads/tongxinli.png",
            ),
            object(),
            self.db,
        )
        web = create_activity(
            ActivityCreate(
                type="LIVE",
                title="网页直播",
                link_url="https://example.com/live",
                live_display_mode="WEB",
            ),
            object(),
            self.db,
        )

        self.assertEqual(calendar.LiveDisplayMode, "CALENDAR")
        self.assertEqual(channels.LiveDisplayMode, "CHANNELS")
        self.assertEqual(channels.JixinliIconUrl, "/uploads/jixinli.png")
        self.assertEqual(channels.TongxinliIconUrl, "/uploads/tongxinli.png")
        self.assertEqual(web.LiveDisplayMode, "WEB")
        self.assertEqual(web.LinkUrl, "https://example.com/live")

    def test_legacy_live_mode_is_inferred(self):
        with_link = create_activity(
            ActivityCreate(type="LIVE", title="旧链接直播", link_url="https://example.com/live"),
            object(),
            self.db,
        )
        without_link = create_activity(
            ActivityCreate(type="LIVE", title="旧图文直播"),
            object(),
            self.db,
        )

        self.assertEqual(with_link.LiveDisplayMode, "WEB")
        self.assertEqual(without_link.LiveDisplayMode, "CALENDAR")

    def test_invalid_live_mode_is_rejected(self):
        with self.assertRaises(HTTPException) as caught:
            create_activity(
                ActivityCreate(type="LIVE", title="错误类型", live_display_mode="UNKNOWN"),
                object(),
                self.db,
            )
        self.assertEqual(caught.exception.status_code, 400)

    def test_banner_link_is_exposed_by_public_api(self):
        create_banner(
            BannerCreate(
                title="了解咨询",
                image_url="/uploads/banner.png",
                link_type="PAGE",
                link_value="/pages/guide/index",
            ),
            object(),
            self.db,
        )

        rows = common_banners(self.db)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["linkType"], "PAGE")
        self.assertEqual(rows[0]["linkValue"], "/pages/guide/index")


if __name__ == "__main__":
    unittest.main()
