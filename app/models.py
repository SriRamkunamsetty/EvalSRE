from enum import Enum

from pydantic import BaseModel, Field


class IncidentSeverity(str, Enum):
    SEV1_CRITICAL = "SEV-1 (Critical)"
    SEV2_MAJOR = "SEV-2 (Major)"
    SEV3_MINOR = "SEV-3 (Minor)"


class FailureCategory(str, Enum):
    FACTUAL_ERROR = "Factual_Hallucination"
    SAFETY_BREACH = "Safety_Boundary_Breach"
    TONE_VIOLATION = "Tone_Unprofessional"
    FORMAT_DRIFT = "Format_Drift"
    REASONING_FLAW = "Reasoning_Flaw"


class IncidentStatus(str, Enum):
    REPORTED = "REPORTED"
    TEST_SYNTHESIZED = "TEST_SYNTHESIZED"
    PATCHED = "PATCHED"
    VERIFIED_RESOLVED = "VERIFIED_RESOLVED"


class ProductionIncident(BaseModel):
    incident_id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    prompt: str = Field(min_length=1)
    failing_response: str = Field(min_length=1)
    expected_behavior: str = Field(min_length=1)
    severity: IncidentSeverity
    category: FailureCategory
    status: IncidentStatus = IncidentStatus.REPORTED
    sha256_fingerprint: str | None = None
    forbidden_tokens: list[str] = Field(default_factory=list)
    required_tokens: list[str] = Field(default_factory=list)


class SynthesizedTestCase(BaseModel):
    test_id: str
    incident_id: str
    function_name: str
    pytest_code: str
    assertion_summary: str


class SREMetrics(BaseModel):
    total_incidents: int
    resolved_count: int
    open_sev1_count: int
    tests_synthesized_count: int
    resolution_rate: float
    category_breakdown: dict[str, int]
