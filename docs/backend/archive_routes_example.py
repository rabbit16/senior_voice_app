"""
档案页 FastAPI 路由示例（可直接拷到后端项目调整 import）。

依赖约定（与本仓库 docs/API.md 对齐）：
  GET /api/v1/health-summaries
  GET /api/v1/health-reports
  GET /api/v1/health-reports/{report_id}
  GET /api/v1/report-glossaries

表：
  health_summaries / health_summary_items
  health_reports / health_report_findings
  report_glossaries

说明：
  - 用 SQLAlchemy 2.0 AsyncSession 写法；若你们用其他 ORM，按同样 SQL 语义改写即可。
  - `get_current_user_id`、`get_db` 请替换为项目里已有的依赖。
  - 本文件不是可运行入口，只作实现模板。
"""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# ---------------------------------------------------------------------------
# 请替换为后端项目内真实依赖
# ---------------------------------------------------------------------------
# from app.api.deps import get_current_user_id, get_db
# from app.db.models import (
#     HealthSummary, HealthSummaryItem, HealthReport, HealthReportFinding, ReportGlossary,
# )


async def get_current_user_id() -> str:  # pragma: no cover - 占位
    raise NotImplementedError("替换为真实鉴权依赖")


async def get_db() -> AsyncSession:  # pragma: no cover - 占位
    raise NotImplementedError("替换为真实 DB session 依赖")


router = APIRouter(tags=["archives-health"])

Severity = Optional[Literal["low", "medium", "high"]]


# ============================ Schemas ============================


class HealthSummaryItemOut(BaseModel):
    id: str
    content: str
    severity: Severity = None
    sort_order: int = 0


class HealthSummaryOut(BaseModel):
    id: str
    title: str
    exam_date: Optional[date] = None
    exam_no: Optional[str] = None
    summary_text: str
    items: list[HealthSummaryItemOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class HealthSummaryListOut(BaseModel):
    items: list[HealthSummaryOut]


class HealthReportListItemOut(BaseModel):
    id: str
    patient_name: str
    exam_date: date
    org_name: str
    voucher_no: str
    report_type: str


class HealthReportListOut(BaseModel):
    items: list[HealthReportListItemOut]
    total: int
    page: int
    page_size: int


class HealthReportFindingOut(BaseModel):
    id: str
    title: str
    suggestion: str
    risk_level: Severity = None
    sort_order: int = 0


class ReportGlossaryOut(BaseModel):
    id: str
    term: str
    definition: str
    sort_order: int = 0


class HealthReportDetailOut(HealthReportListItemOut):
    findings: list[HealthReportFindingOut] = Field(default_factory=list)
    full_text: Optional[str] = None
    glossary: list[ReportGlossaryOut] = Field(default_factory=list)


class ReportGlossaryListOut(BaseModel):
    items: list[ReportGlossaryOut]


# ============================ Helpers ============================


def _as_str(value: Any) -> str:
    return str(value)


def _full_text_from_payload(raw_payload: Any) -> Optional[str]:
    if raw_payload is None:
        return None
    if isinstance(raw_payload, str):
        try:
            raw_payload = json.loads(raw_payload)
        except json.JSONDecodeError:
            return raw_payload
    if isinstance(raw_payload, dict):
        text_value = raw_payload.get("full_text")
        return text_value if isinstance(text_value, str) else None
    return None


# ============================ Routes（ORM 版示意）============================
#
# 若已有 ORM Model，推荐这种写法。下面注释块展示完整查询语义；
# 若暂时没有 Model，用文末「纯 SQL 版」同样能跑通前端。


@router.get("/health-summaries", response_model=HealthSummaryListOut)
async def list_health_summaries(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> HealthSummaryListOut:
    """
    对应表：health_summaries + health_summary_items
    前端档案首页卡片。
    """
    # ---- ORM 示意（取消注释并改成真实 Model）----
    # stmt: Select = (
    #     select(HealthSummary)
    #     .where(HealthSummary.user_id == user_id, HealthSummary.deleted_at.is_(None))
    #     .options(selectinload(HealthSummary.items))
    #     .order_by(HealthSummary.updated_at.desc())
    # )
    # rows = (await db.execute(stmt)).scalars().all()
    # return HealthSummaryListOut(items=[...])

    rows = (
        await db.execute(
            text(
                """
                SELECT id, title, exam_date, exam_no, summary_text, created_at, updated_at
                FROM health_summaries
                WHERE user_id = :user_id AND deleted_at IS NULL
                ORDER BY updated_at DESC
                """
            ),
            {"user_id": user_id},
        )
    ).mappings().all()

    items_out: list[HealthSummaryOut] = []
    for row in rows:
        item_rows = (
            await db.execute(
                text(
                    """
                    SELECT id, content, severity, sort_order
                    FROM health_summary_items
                    WHERE summary_id = :summary_id
                    ORDER BY sort_order ASC, created_at ASC
                    """
                ),
                {"summary_id": row["id"]},
            )
        ).mappings().all()
        items_out.append(
            HealthSummaryOut(
                id=_as_str(row["id"]),
                title=row["title"],
                exam_date=row["exam_date"],
                exam_no=row["exam_no"],
                summary_text=row["summary_text"],
                items=[
                    HealthSummaryItemOut(
                        id=_as_str(i["id"]),
                        content=i["content"],
                        severity=i["severity"],
                        sort_order=int(i["sort_order"] or 0),
                    )
                    for i in item_rows
                ],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )
        )
    return HealthSummaryListOut(items=items_out)


@router.get("/health-reports", response_model=HealthReportListOut)
async def list_health_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> HealthReportListOut:
    """对应表：health_reports。前端报告时间轴。"""
    offset = (page - 1) * page_size
    total = (
        await db.execute(
            text(
                """
                SELECT COUNT(1) AS cnt
                FROM health_reports
                WHERE user_id = :user_id AND deleted_at IS NULL
                """
            ),
            {"user_id": user_id},
        )
    ).scalar_one()

    rows = (
        await db.execute(
            text(
                """
                SELECT id, patient_name, exam_date, org_name, voucher_no, report_type
                FROM health_reports
                WHERE user_id = :user_id AND deleted_at IS NULL
                ORDER BY exam_date DESC, created_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            {"user_id": user_id, "limit": page_size, "offset": offset},
        )
    ).mappings().all()

    return HealthReportListOut(
        items=[
            HealthReportListItemOut(
                id=_as_str(r["id"]),
                patient_name=r["patient_name"],
                exam_date=r["exam_date"],
                org_name=r["org_name"],
                voucher_no=r["voucher_no"],
                report_type=r["report_type"],
            )
            for r in rows
        ],
        total=int(total or 0),
        page=page,
        page_size=page_size,
    )


@router.get("/health-reports/{report_id}", response_model=HealthReportDetailOut)
async def get_health_report(
    report_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> HealthReportDetailOut:
    """对应表：health_reports + health_report_findings；术语来自 report_glossaries。"""
    row = (
        await db.execute(
            text(
                """
                SELECT id, patient_name, exam_date, org_name, voucher_no, report_type, raw_payload
                FROM health_reports
                WHERE id = :report_id AND user_id = :user_id AND deleted_at IS NULL
                LIMIT 1
                """
            ),
            {"report_id": report_id, "user_id": user_id},
        )
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="报告不存在")

    finding_rows = (
        await db.execute(
            text(
                """
                SELECT id, title, suggestion, risk_level, sort_order
                FROM health_report_findings
                WHERE report_id = :report_id
                ORDER BY sort_order ASC, created_at ASC
                """
            ),
            {"report_id": report_id},
        )
    ).mappings().all()

    glossary_rows = (
        await db.execute(
            text(
                """
                SELECT id, term, definition, sort_order
                FROM report_glossaries
                WHERE enabled = 1
                ORDER BY sort_order ASC, created_at ASC
                """
            )
        )
    ).mappings().all()

    return HealthReportDetailOut(
        id=_as_str(row["id"]),
        patient_name=row["patient_name"],
        exam_date=row["exam_date"],
        org_name=row["org_name"],
        voucher_no=row["voucher_no"],
        report_type=row["report_type"],
        findings=[
            HealthReportFindingOut(
                id=_as_str(f["id"]),
                title=f["title"],
                suggestion=f["suggestion"],
                risk_level=f["risk_level"],
                sort_order=int(f["sort_order"] or 0),
            )
            for f in finding_rows
        ],
        full_text=_full_text_from_payload(row["raw_payload"]),
        glossary=[
            ReportGlossaryOut(
                id=_as_str(g["id"]),
                term=g["term"],
                definition=g["definition"],
                sort_order=int(g["sort_order"] or 0),
            )
            for g in glossary_rows
        ],
    )


@router.get("/report-glossaries", response_model=ReportGlossaryListOut)
async def list_report_glossaries(
    _user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReportGlossaryListOut:
    """对应表：report_glossaries（全局配置）。"""
    rows = (
        await db.execute(
            text(
                """
                SELECT id, term, definition, sort_order
                FROM report_glossaries
                WHERE enabled = 1
                ORDER BY sort_order ASC, created_at ASC
                """
            )
        )
    ).mappings().all()
    return ReportGlossaryListOut(
        items=[
            ReportGlossaryOut(
                id=_as_str(r["id"]),
                term=r["term"],
                definition=r["definition"],
                sort_order=int(r["sort_order"] or 0),
            )
            for r in rows
        ]
    )


# ============================ 挂载示例 ============================
#
# from fastapi import FastAPI
# from .archive_routes_example import router as archive_health_router
#
# app = FastAPI()
# app.include_router(archive_health_router, prefix="/api/v1")
#
# 联调步骤：
#   1. mysql … < docs/database/schema.sql
#   2. 修改 seed_archive.sql 里的 @seed_phone 后导入
#   3. 启动后端，前端登录同一手机号，打开档案页

