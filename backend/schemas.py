from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Literal


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str


class JobCreate(BaseModel):
    title: str
    description: str
    status: str = "Draft"

class JobResponse(BaseModel):
    id: int
    title: str
    description: str
    status: str
    requirements_confirmed: bool
    created_by_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class RequirementCreate(BaseModel):
    text: str
    requirement_type: str
    weight: float = 1.0

class RequirementResponse(BaseModel):
    id: int
    job_id: int
    text: str
    requirement_type: str
    weight: float
    sort_order: int

    class Config:
        from_attributes = True


class RequirementUpdate(BaseModel):
    text: str
    requirement_type: str
    weight: float


class ApplicationStageUpdate(BaseModel):
    stage: Literal[
        "New",
        "Shortlisted",
        "Interview",
        "Rejected",
        "Hired",
    ]
    reason: str | None = None

class JobStatusUpdate(BaseModel):
    status: Literal["Draft", "Open", "Closed"]

class JobUpdate(BaseModel):
    title: str
    description: str