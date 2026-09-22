import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.platform_setting import PlatformSetting


class PlatformSettingRepository:
    def get(self, db: Session, key: str) -> PlatformSetting | None:
        return db.execute(
            select(PlatformSetting).where(PlatformSetting.key == key)
        ).scalar_one_or_none()

    def get_or_create(self, db: Session, key: str, default: dict | None = None) -> PlatformSetting:
        setting = self.get(db, key)
        if setting is None:
            setting = PlatformSetting(key=key, value=default or {})
            db.add(setting)
            db.flush()
        return setting

    def set_value(self, db: Session, key: str, value: dict, *, actor_id: uuid.UUID | None = None) -> PlatformSetting:
        setting = self.get_or_create(db, key, value)
        setting.value = value
        if actor_id is not None:
            setting.updated_by = actor_id
        db.flush()
        return setting

    def list_all(self, db: Session) -> list[PlatformSetting]:
        return list(db.execute(select(PlatformSetting).order_by(PlatformSetting.key)).scalars().all())


platform_setting_repository = PlatformSettingRepository()